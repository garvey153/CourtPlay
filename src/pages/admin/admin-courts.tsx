import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, SearchSm, XClose } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { supabase } from "@/lib/supabase";
import { AdminCourtCard, type AdminCourtRow, type CustomCourtRow } from "./admin-court-card";
import { AdminCourtSheet, type CourtSheetTarget } from "./admin-court-sheet";

export function AdminCourts() {
    const [courts, setCourts] = useState<AdminCourtRow[]>([]);
    const [customCourts, setCustomCourts] = useState<CustomCourtRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState("");
    const [sheet, setSheet] = useState<CourtSheetTarget | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);

        const [courtsRes, customRes] = await Promise.all([
            supabase.from("courts").select("id, name, area, active").order("name"),
            // Custom courts entered on posts — one row per court name. They live on the posts
            // only; the admin can add them to the master list or remove them here.
            supabase
                .from("custom_court_submissions")
                .select("id, court_name, submission_count, area")
                .order("submission_count", { ascending: false }),
        ]);

        // The master court list is the core of the tab — only its failure blanks the view.
        if (courtsRes.error) {
            setError("Failed to load courts.");
            setLoading(false);
            return;
        }

        setCourts(((courtsRes.data as AdminCourtRow[]) ?? []).filter((c) => c.active));
        // A custom-list failure shouldn't break the whole tab — degrade to empty and log it.
        if (customRes.error) {
            console.warn("Failed to load custom courts:", customRes.error.message);
            setCustomCourts([]);
        } else {
            setCustomCourts((customRes.data as CustomCourtRow[]) ?? []);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const visibleCourts = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return courts;
        return courts.filter((c) => [c.name, c.area].filter(Boolean).join(" ").toLowerCase().includes(q));
    }, [courts, search]);

    const handleSaved = () => {
        setSheet(null);
        fetchData();
    };

    // Custom courts get their own section header (with "Active" below) only when present.
    const hasSections = customCourts.length > 0;

    const courtList = (
        <div className="flex flex-col gap-3">
            {visibleCourts.map((court) => (
                <AdminCourtCard
                    key={court.id}
                    title={court.name}
                    subtitle={court.area}
                    tone="active"
                    onOpen={() => setSheet({ mode: "court", court })}
                />
            ))}
        </div>
    );

    return (
        <div className="flex flex-col gap-4">
            {/* Search + add row (design 149:1330) */}
            <div className="flex items-center gap-3">
                <div className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-neutral-700 px-3 shadow-xs">
                    <SearchSm className="size-6 shrink-0 text-tertiary" strokeWidth={1} aria-hidden="true" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search courts"
                        className="w-full bg-transparent text-sm text-primary placeholder:text-tertiary focus:outline-none"
                    />
                    {search && (
                        <button
                            type="button"
                            aria-label="Clear search"
                            onClick={() => setSearch("")}
                            className="shrink-0 text-tertiary transition duration-100 ease-linear hover:text-primary"
                        >
                            <XClose className="size-5" strokeWidth={1} />
                        </button>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => setSheet({ mode: "create" })}
                    aria-label="Add court"
                    className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-brand-500 text-neutral-950 transition duration-100 ease-linear hover:bg-brand-600"
                >
                    <Plus className="size-4" strokeWidth={2.5} aria-hidden="true" />
                </button>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="size-6 animate-spin rounded-full border-2 border-border-secondary border-t-brand-solid" />
                </div>
            ) : error ? (
                <div className="flex flex-col items-center gap-4 py-16 text-center">
                    <p className="text-sm text-error-primary">{error}</p>
                    <Button size="sm" color="primary" onClick={fetchData}>
                        Retry
                    </Button>
                </div>
            ) : visibleCourts.length === 0 && customCourts.length === 0 ? (
                <p className="py-16 text-center text-sm text-tertiary">
                    {search ? "No courts match your search." : "No courts yet."}
                </p>
            ) : hasSections ? (
                <div className="flex flex-col gap-5">
                    <div>
                        <p className="mb-2 text-xs font-medium text-tertiary">Custom</p>
                        <div className="flex flex-col gap-3">
                            {customCourts.map((c) => (
                                <AdminCourtCard
                                    key={c.id}
                                    title={c.court_name}
                                    subtitle={c.area ?? "(No area provided)"}
                                    tone="custom"
                                    onOpen={() => setSheet({ mode: "custom", custom: c })}
                                />
                            ))}
                        </div>
                    </div>
                    {visibleCourts.length > 0 && (
                        <div>
                            <p className="mb-2 text-xs font-medium text-tertiary">Active</p>
                            {courtList}
                        </div>
                    )}
                </div>
            ) : (
                courtList
            )}

            {sheet && <AdminCourtSheet target={sheet} onClose={() => setSheet(null)} onSaved={handleSaved} />}
        </div>
    );
}
