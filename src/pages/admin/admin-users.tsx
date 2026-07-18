import { useCallback, useEffect, useMemo, useState } from "react";
import { FilterLines, SearchSm, XClose } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { supabase } from "@/lib/supabase";
import { AdminUserCard, type AdminUserRow } from "./admin-user-card";
import { AdminUserDetailSheet } from "./admin-user-detail-sheet";
import { AdminUserFilterSheet, EMPTY_USER_FILTERS, userFilterCount, type UserFilters } from "./admin-user-filter-sheet";

// Admin shows every user; loads a generous cap and filters client-side.
const FETCH_LIMIT = 500;

interface UserRow {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    skill_level: string | null;
    is_admin: boolean;
    is_suspended: boolean;
    created_at: string;
    photo_url: string | null;
}

function matchesFilters(user: AdminUserRow, f: UserFilters): boolean {
    if (f.status === "active" && user.is_suspended) return false;
    if (f.status === "suspended" && !user.is_suspended) return false;
    if (f.adminsOnly && !user.is_admin) return false;
    return true;
}

function matchesSearch(user: AdminUserRow, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [user.first_name, user.last_name, user.email].filter(Boolean).join(" ").toLowerCase().includes(q);
}

export function AdminUsers() {
    const [users, setUsers] = useState<AdminUserRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState("");
    const [filters, setFilters] = useState<UserFilters>(EMPTY_USER_FILTERS);
    const [filtersOpen, setFiltersOpen] = useState(false);

    const [detailUser, setDetailUser] = useState<AdminUserRow | null>(null);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setError(null);

        const usersRes = await supabase
            .from("users")
            .select("id, first_name, last_name, email, skill_level, is_admin, is_suspended, created_at, photo_url")
            .order("created_at", { ascending: false })
            .limit(FETCH_LIMIT);

        if (usersRes.error) {
            setError(usersRes.error.message);
            setUsers([]);
            setLoading(false);
            return;
        }

        const rows = (usersRes.data as UserRow[]) ?? [];

        // Report counts per user (for the moderation sheet).
        const reportCounts = new Map<string, number>();
        if (rows.length > 0) {
            const { data: reports } = await supabase
                .from("reports")
                .select("target_id")
                .eq("target_type", "user")
                .in(
                    "target_id",
                    rows.map((u) => u.id),
                );
            for (const r of (reports as { target_id: string }[]) ?? []) {
                reportCounts.set(r.target_id, (reportCounts.get(r.target_id) ?? 0) + 1);
            }
        }

        setUsers(
            rows.map<AdminUserRow>((u) => ({
                ...u,
                report_count: reportCounts.get(u.id) ?? 0,
            })),
        );
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const visibleUsers = useMemo(
        () => users.filter((u) => matchesFilters(u, filters) && matchesSearch(u, search)),
        [users, filters, search],
    );

    const handleSaved = () => {
        setDetailUser(null);
        fetchUsers();
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Search + filter row (design 348:4818) */}
            <div className="flex items-center gap-3">
                <div className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-neutral-700 px-3 shadow-xs">
                    <SearchSm className="size-6 shrink-0 text-tertiary" strokeWidth={1} aria-hidden="true" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search users"
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
                    onClick={() => setFiltersOpen((v) => !v)}
                    aria-label="Filter users"
                    className="relative shrink-0 rounded-lg p-1.5 text-tertiary transition duration-100 ease-linear hover:text-secondary"
                >
                    <FilterLines className="size-6" aria-hidden="true" />
                    {userFilterCount(filters) > 0 && (
                        <span className="absolute right-1 top-[7px] size-1.5 rounded-full bg-brand-solid ring-2 ring-bg-primary" />
                    )}
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
                    <Button size="sm" color="primary" onClick={fetchUsers}>
                        Retry
                    </Button>
                </div>
            ) : visibleUsers.length === 0 ? (
                <p className="py-16 text-center text-sm text-tertiary">No users match your filters.</p>
            ) : (
                <div className="flex flex-col gap-3">
                    {visibleUsers.map((user) => (
                        <AdminUserCard key={user.id} user={user} onOpen={setDetailUser} />
                    ))}
                </div>
            )}

            <AdminUserFilterSheet
                filters={filters}
                onChange={setFilters}
                isOpen={filtersOpen}
                onToggle={() => setFiltersOpen((v) => !v)}
            />

            {detailUser && (
                <AdminUserDetailSheet user={detailUser} onClose={() => setDetailUser(null)} onSaved={handleSaved} />
            )}
        </div>
    );
}
