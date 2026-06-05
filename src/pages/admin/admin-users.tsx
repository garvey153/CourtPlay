import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import { supabase } from "@/lib/supabase";

const PAGE_SIZE = 20;

interface AdminUser {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    skill_level: string | null;
    is_admin: boolean;
    is_suspended: boolean;
    created_at: string;
    deleted_at: string | null;
}

type UserStatusFilter = "all" | "active" | "suspended";

function formatDate(dateStr: string | null): string {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

export function AdminUsers() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(0);

    // Filters
    const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("all");
    const [search, setSearch] = useState("");

    // Report counts keyed by user ID
    const [reportCounts, setReportCounts] = useState<Record<string, number>>({});

    // Track in-progress actions to disable buttons
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setError(null);

        const offset = page * PAGE_SIZE;
        let query = supabase
            .from("users")
            .select(
                "id, first_name, last_name, email, skill_level, is_admin, is_suspended, created_at, deleted_at",
                { count: "exact" },
            )
            .order("created_at", { ascending: false })
            .range(offset, offset + PAGE_SIZE - 1);

        if (statusFilter === "active") {
            query = query.eq("is_suspended", false);
        } else if (statusFilter === "suspended") {
            query = query.eq("is_suspended", true);
        }

        if (search.trim()) {
            const term = `%${search.trim()}%`;
            query = query.or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`);
        }

        const { data, error: fetchError, count } = await query;

        if (fetchError) {
            setError(fetchError.message);
            setUsers([]);
        } else {
            const fetchedUsers = (data as AdminUser[]) ?? [];
            setUsers(fetchedUsers);
            setTotalCount(count ?? 0);

            // Fetch report counts for these users
            if (fetchedUsers.length > 0) {
                const userIds = fetchedUsers.map((u) => u.id);
                const { data: reports } = await supabase
                    .from("reports")
                    .select("target_id")
                    .eq("target_type", "user")
                    .in("target_id", userIds);

                if (reports) {
                    const counts: Record<string, number> = {};
                    for (const r of reports) {
                        counts[r.target_id] = (counts[r.target_id] ?? 0) + 1;
                    }
                    setReportCounts(counts);
                }
            }
        }
        setLoading(false);
    }, [page, statusFilter, search]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // Reset to page 0 when filters change
    useEffect(() => {
        setPage(0);
    }, [statusFilter, search]);

    const toggleSuspend = async (userId: string, currentlySuspended: boolean) => {
        setActionLoading(userId);
        const { error: updateError } = await supabase
            .from("users")
            .update({ is_suspended: !currentlySuspended })
            .eq("id", userId);

        if (updateError) {
            setError(`Failed to update: ${updateError.message}`);
        } else {
            fetchUsers();
        }
        setActionLoading(null);
    };

    const toggleAdmin = async (userId: string, currentlyAdmin: boolean) => {
        setActionLoading(userId);
        const { error: updateError } = await supabase
            .from("users")
            .update({ is_admin: !currentlyAdmin })
            .eq("id", userId);

        if (updateError) {
            setError(`Failed to update: ${updateError.message}`);
        } else {
            fetchUsers();
        }
        setActionLoading(null);
    };

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    return (
        <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-primary">Users</h2>

            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-3">
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as UserStatusFilter)}
                    className="rounded-lg border border-primary bg-primary px-3 py-2 text-sm text-primary shadow-xs"
                >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                </select>

                <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="rounded-lg border border-primary bg-primary px-3 py-2 text-sm text-primary shadow-xs placeholder:text-placeholder"
                />
            </div>

            {/* Summary */}
            <p className="text-sm text-tertiary">
                {totalCount} user{totalCount !== 1 ? "s" : ""} found
            </p>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="size-6 animate-spin rounded-full border-2 border-border-secondary border-t-brand-solid" />
                </div>
            ) : error ? (
                <div className="flex flex-col items-center gap-4 py-16 text-center">
                    <p className="text-sm text-error-primary">{error}</p>
                    <Button size="sm" color="primary" onClick={fetchUsers}>
                        Retry
                    </Button>
                </div>
            ) : users.length === 0 ? (
                <p className="py-16 text-center text-sm text-tertiary">No users match your filters.</p>
            ) : (
                <>
                    {/* Desktop table */}
                    <div className="hidden overflow-x-auto md:block">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-secondary text-xs font-medium text-tertiary">
                                    <th className="px-3 py-3">Name</th>
                                    <th className="px-3 py-3">Email</th>
                                    <th className="px-3 py-3">Skill Level</th>
                                    <th className="px-3 py-3">Joined</th>
                                    <th className="px-3 py-3">Status</th>
                                    <th className="px-3 py-3">Admin</th>
                                    <th className="px-3 py-3">Reports</th>
                                    <th className="px-3 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr key={u.id} className="border-b border-secondary">
                                        <td className="px-3 py-3 text-primary">
                                            {u.first_name} {u.last_name}
                                        </td>
                                        <td className="px-3 py-3 text-secondary">{u.email}</td>
                                        <td className="px-3 py-3 capitalize text-secondary">{u.skill_level ?? "-"}</td>
                                        <td className="px-3 py-3 text-secondary">{formatDate(u.created_at)}</td>
                                        <td className="px-3 py-3">
                                            {u.is_suspended ? (
                                                <Badge color="error" size="sm" type="pill-color">Suspended</Badge>
                                            ) : (
                                                <Badge color="success" size="sm" type="pill-color">Active</Badge>
                                            )}
                                        </td>
                                        <td className="px-3 py-3">
                                            {u.is_admin ? (
                                                <Badge color="brand" size="sm" type="pill-color">Admin</Badge>
                                            ) : (
                                                <span className="text-tertiary">-</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 text-secondary">
                                            {reportCounts[u.id] ? (
                                                <Badge color="warning" size="sm" type="pill-color">
                                                    {reportCounts[u.id]}
                                                </Badge>
                                            ) : (
                                                "0"
                                            )}
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="xs"
                                                    color={u.is_suspended ? "primary" : "primary-destructive"}
                                                    isDisabled={actionLoading === u.id}
                                                    onClick={() => toggleSuspend(u.id, u.is_suspended)}
                                                >
                                                    {u.is_suspended ? "Unsuspend" : "Suspend"}
                                                </Button>
                                                <Button
                                                    size="xs"
                                                    color="secondary"
                                                    isDisabled={actionLoading === u.id}
                                                    onClick={() => toggleAdmin(u.id, u.is_admin)}
                                                >
                                                    {u.is_admin ? "Remove Admin" : "Make Admin"}
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="flex flex-col gap-3 md:hidden">
                        {users.map((u) => (
                            <div key={u.id} className="rounded-xl border border-secondary bg-primary p-4 shadow-xs">
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="text-sm font-medium text-primary">
                                        {u.first_name} {u.last_name}
                                    </span>
                                    {u.is_suspended ? (
                                        <Badge color="error" size="sm" type="pill-color">Suspended</Badge>
                                    ) : (
                                        <Badge color="success" size="sm" type="pill-color">Active</Badge>
                                    )}
                                </div>

                                <div className="mb-3 grid grid-cols-2 gap-y-1 text-sm">
                                    <span className="text-tertiary">Email</span>
                                    <span className="truncate text-secondary">{u.email}</span>
                                    <span className="text-tertiary">Skill</span>
                                    <span className="capitalize text-secondary">{u.skill_level ?? "-"}</span>
                                    <span className="text-tertiary">Joined</span>
                                    <span className="text-secondary">{formatDate(u.created_at)}</span>
                                    <span className="text-tertiary">Admin</span>
                                    <span className="text-secondary">{u.is_admin ? "Yes" : "No"}</span>
                                    <span className="text-tertiary">Reports</span>
                                    <span className="text-secondary">{reportCounts[u.id] ?? 0}</span>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        size="xs"
                                        color={u.is_suspended ? "primary" : "primary-destructive"}
                                        isDisabled={actionLoading === u.id}
                                        onClick={() => toggleSuspend(u.id, u.is_suspended)}
                                    >
                                        {u.is_suspended ? "Unsuspend" : "Suspend"}
                                    </Button>
                                    <Button
                                        size="xs"
                                        color="secondary"
                                        isDisabled={actionLoading === u.id}
                                        onClick={() => toggleAdmin(u.id, u.is_admin)}
                                    >
                                        {u.is_admin ? "Remove Admin" : "Make Admin"}
                                    </Button>
                                </div>

                                <p className="mt-3 text-xs text-tertiary">
                                    Password resets are managed through the Supabase dashboard.
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-2">
                            <Button
                                size="sm"
                                color="secondary"
                                isDisabled={page === 0}
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                            >
                                Previous
                            </Button>
                            <span className="text-sm text-tertiary">
                                Page {page + 1} of {totalPages}
                            </span>
                            <Button
                                size="sm"
                                color="secondary"
                                isDisabled={page >= totalPages - 1}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                Next
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
