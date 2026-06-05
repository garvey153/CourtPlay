import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import { Input } from "@/components/base/input/input";
import { supabase } from "@/lib/supabase";

interface Court {
    id: string;
    name: string;
    area: string | null;
    active: boolean;
}

interface CustomCourtPlaymission {
    id: string;
    court_name: string;
    submission_count: number;
    submitted_by: string;
    alerted: boolean;
}

export function AdminCourts() {
    const [courts, setCourts] = useState<Court[]>([]);
    const [submissions, setSubmissions] = useState<CustomCourtPlaymission[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Add court form
    const [newCourtName, setNewCourtName] = useState("");
    const [newCourtArea, setNewCourtArea] = useState("");
    const [addingCourt, setAddingCourt] = useState(false);

    // Inline edit
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editArea, setEditArea] = useState("");

    const fetchData = useCallback(async () => {
        setError(null);
        try {
            const [courtsRes, subsRes] = await Promise.all([
                supabase.from("courts").select("id, name, area, active").order("name"),
                supabase.from("custom_court_submissions").select("*").gte("submission_count", 3).order("submission_count", { ascending: false }),
            ]);

            if (courtsRes.error || subsRes.error) {
                setError("Failed to load courts data.");
            } else {
                setCourts(courtsRes.data ?? []);
                setSubmissions(subsRes.data ?? []);
            }
        } catch {
            setError("Failed to load courts data.");
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleToggleActive = useCallback(async (court: Court) => {
        setActionLoading(court.id);
        await supabase.from("courts").update({ active: !court.active }).eq("id", court.id);
        setActionLoading(null);
        fetchData();
    }, [fetchData]);

    const handleStartEdit = useCallback((court: Court) => {
        setEditingId(court.id);
        setEditName(court.name);
        setEditArea(court.area ?? "");
    }, []);

    const handleSaveEdit = useCallback(async () => {
        if (!editingId || !editName.trim()) return;
        setActionLoading(editingId);
        await supabase.from("courts").update({
            name: editName.trim(),
            area: editArea.trim() || null,
        }).eq("id", editingId);
        setEditingId(null);
        setActionLoading(null);
        fetchData();
    }, [editingId, editName, editArea, fetchData]);

    const handleAddCourt = useCallback(async () => {
        if (!newCourtName.trim()) return;
        setAddingCourt(true);
        await supabase.from("courts").insert({
            name: newCourtName.trim(),
            area: newCourtArea.trim() || null,
            active: true,
        });
        setNewCourtName("");
        setNewCourtArea("");
        setAddingCourt(false);
        fetchData();
    }, [newCourtName, newCourtArea, fetchData]);

    const handleAddToMasterList = useCallback(async (sub: CustomCourtPlaymission) => {
        setActionLoading(sub.id);
        await supabase.from("courts").insert({
            name: sub.court_name,
            area: null,
            active: true,
        });
        // Mark submission as handled
        await supabase.from("custom_court_submissions").update({ alerted: true }).eq("id", sub.id);
        setActionLoading(null);
        fetchData();
    }, [fetchData]);

    const handleDismissSubmission = useCallback(async (subId: string) => {
        setActionLoading(subId);
        await supabase.from("custom_court_submissions").update({ alerted: true }).eq("id", subId);
        setActionLoading(null);
        fetchData();
    }, [fetchData]);

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="size-6 animate-spin rounded-full border-2 border-border-secondary border-t-brand-solid" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
                <p className="text-sm text-error-primary">{error}</p>
                <Button color="secondary" size="sm" onClick={fetchData}>Retry</Button>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* ── Master Court List ────────────────────────────────────────── */}
            <section>
                <h2 className="text-base font-semibold text-primary">Master Court List</h2>
                <p className="mt-1 text-xs text-tertiary">{courts.length} courts</p>

                <div className="mt-4 space-y-2">
                    {courts.map((court) => (
                        <div
                            key={court.id}
                            className="flex items-center gap-3 rounded-xl border border-secondary bg-primary p-3"
                        >
                            {editingId === court.id ? (
                                <div className="flex flex-1 flex-col gap-2">
                                    <Input
                                        label="Name"
                                        value={editName}
                                        onChange={setEditName}
                                        size="sm"
                                    />
                                    <Input
                                        label="Area"
                                        value={editArea}
                                        onChange={setEditArea}
                                        size="sm"
                                    />
                                    <div className="flex gap-2">
                                        <Button
                                            color="primary"
                                            size="xs"
                                            onClick={handleSaveEdit}
                                            isLoading={actionLoading === court.id}
                                        >
                                            Save
                                        </Button>
                                        <Button
                                            color="secondary"
                                            size="xs"
                                            onClick={() => setEditingId(null)}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-primary">{court.name}</p>
                                        {court.area && (
                                            <p className="text-xs text-tertiary">{court.area}</p>
                                        )}
                                    </div>
                                    <Badge
                                        color={court.active ? "success" : "gray"}
                                        size="sm"
                                        type="pill-color"
                                    >
                                        {court.active ? "Active" : "Inactive"}
                                    </Badge>
                                    <div className="flex gap-1">
                                        <button
                                            className="text-xs text-brand-secondary underline underline-offset-2"
                                            onClick={() => handleStartEdit(court)}
                                        >
                                            Edit
                                        </button>
                                        <Button
                                            color="secondary"
                                            size="xs"
                                            onClick={() => handleToggleActive(court)}
                                            isLoading={actionLoading === court.id}
                                        >
                                            {court.active ? "Deactivate" : "Activate"}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>

                {/* Add new court */}
                <div className="mt-4 rounded-xl border border-secondary bg-secondary_subtle p-4">
                    <p className="mb-3 text-sm font-medium text-secondary">Add new court</p>
                    <div className="flex flex-col gap-2">
                        <Input
                            label="Court name"
                            placeholder="e.g. Longshore Tennis Club"
                            value={newCourtName}
                            onChange={setNewCourtName}
                            size="sm"
                        />
                        <Input
                            label="Area (optional)"
                            placeholder="e.g. Westport"
                            value={newCourtArea}
                            onChange={setNewCourtArea}
                            size="sm"
                        />
                        <Button
                            color="primary"
                            size="sm"
                            onClick={handleAddCourt}
                            isLoading={addingCourt}
                            isDisabled={!newCourtName.trim()}
                            className="self-start"
                        >
                            Add court
                        </Button>
                    </div>
                </div>
            </section>

            {/* ── Custom Court Submissions Queue ──────────────────────────── */}
            <section>
                <h2 className="text-base font-semibold text-primary">Custom Court Submissions</h2>
                <p className="mt-1 text-xs text-tertiary">
                    Courts submitted by users 3+ times that aren't in the master list.
                </p>

                {submissions.length === 0 ? (
                    <p className="mt-4 text-sm text-tertiary">No submissions needing review.</p>
                ) : (
                    <div className="mt-4 space-y-2">
                        {submissions.map((sub) => (
                            <div
                                key={sub.id}
                                className="flex items-center gap-3 rounded-xl border border-secondary bg-primary p-3"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-primary">{sub.court_name}</p>
                                    <p className="text-xs text-tertiary">
                                        {sub.submission_count} submissions
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        color="primary"
                                        size="xs"
                                        onClick={() => handleAddToMasterList(sub)}
                                        isLoading={actionLoading === sub.id}
                                    >
                                        Add to list
                                    </Button>
                                    <Button
                                        color="secondary"
                                        size="xs"
                                        onClick={() => handleDismissSubmission(sub.id)}
                                        isLoading={actionLoading === sub.id}
                                    >
                                        Dismiss
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
