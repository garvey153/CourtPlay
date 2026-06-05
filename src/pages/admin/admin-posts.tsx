import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

const PAGE_SIZE = 20;

interface PostAuthor {
    first_name: string | null;
    last_name: string | null;
    email: string;
}

interface AdminPost {
    id: string;
    post_type: string | null;
    format: string | null;
    game_date: string | null;
    game_time: string | null;
    location: string | null;
    custom_court: string | null;
    cost: number | null;
    original_cost: number | null;
    status: string;
    spots_total: number | null;
    created_at: string;
    deleted_at: string | null;
    author_id: string;
    users: PostAuthor;
}

type StatusFilter = "all" | "active" | "expired" | "deleted";
type FormatFilter = "all" | "singles" | "doubles";

function statusBadge(status: string) {
    switch (status) {
        case "active":
            return <Badge color="success" size="sm" type="pill-color">Active</Badge>;
        case "expired":
            return <Badge color="warning" size="sm" type="pill-color">Expired</Badge>;
        case "deleted":
            return <Badge color="error" size="sm" type="pill-color">Deleted</Badge>;
        default:
            return <Badge color="gray" size="sm" type="pill-color">{status}</Badge>;
    }
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

export function AdminPosts() {
    const { user } = useAuth();

    const [posts, setPosts] = useState<AdminPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(0);

    // Filters
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [formatFilter, setFormatFilter] = useState<FormatFilter>("all");
    const [search, setSearch] = useState("");

    // Inline editing
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editCost, setEditCost] = useState("");
    const [editLocation, setEditLocation] = useState("");

    // Confirmation for destructive actions
    const [confirmingAction, setConfirmingAction] = useState<{ id: string; action: "delete" | "expire" } | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchPosts = useCallback(async () => {
        setLoading(true);
        setError(null);

        const offset = page * PAGE_SIZE;
        let query = supabase
            .from("posts")
            .select(
                "id, post_type, format, game_date, game_time, location, custom_court, cost, original_cost, status, spots_total, created_at, deleted_at, author_id, users:author_id(first_name, last_name, email)",
                { count: "exact" },
            )
            .order("created_at", { ascending: false })
            .range(offset, offset + PAGE_SIZE - 1);

        if (statusFilter !== "all") {
            query = query.eq("status", statusFilter);
        }
        if (formatFilter !== "all") {
            query = query.eq("format", formatFilter);
        }
        if (search.trim()) {
            query = query.ilike("location", `%${search.trim()}%`);
        }

        const { data, error: fetchError, count } = await query;

        if (fetchError) {
            setError(fetchError.message);
            setPosts([]);
        } else {
            setPosts((data as unknown as AdminPost[]) ?? []);
            setTotalCount(count ?? 0);
        }
        setLoading(false);
    }, [page, statusFilter, formatFilter, search]);

    useEffect(() => {
        fetchPosts();
    }, [fetchPosts]);

    // Reset to page 0 when filters change
    useEffect(() => {
        setPage(0);
    }, [statusFilter, formatFilter, search]);

    const handleDelete = async (postId: string) => {
        if (!user) return;
        setActionLoading(postId);
        const { error: updateError } = await supabase
            .from("posts")
            .update({
                status: "deleted",
                deleted_at: new Date().toISOString(),
                deleted_by: user.id,
            })
            .eq("id", postId);

        setActionLoading(null);
        setConfirmingAction(null);
        if (updateError) {
            setError(`Failed to delete: ${updateError.message}`);
        } else {
            fetchPosts();
        }
    };

    const handleExpire = async (postId: string) => {
        setActionLoading(postId);
        const { error: updateError } = await supabase
            .from("posts")
            .update({ status: "expired" })
            .eq("id", postId);

        setActionLoading(null);
        setConfirmingAction(null);
        if (updateError) {
            setError(`Failed to expire: ${updateError.message}`);
        } else {
            fetchPosts();
        }
    };

    const startEdit = (post: AdminPost) => {
        setEditingId(post.id);
        setEditCost(post.cost?.toString() ?? "");
        setEditLocation(post.location ?? "");
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditCost("");
        setEditLocation("");
    };

    const saveEdit = async () => {
        if (!editingId) return;

        const { error: updateError } = await supabase
            .from("posts")
            .update({
                cost: editCost ? parseFloat(editCost) : null,
                location: editLocation || null,
            })
            .eq("id", editingId);

        if (updateError) {
            setError(`Failed to save: ${updateError.message}`);
        } else {
            cancelEdit();
            fetchPosts();
        }
    };

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    return (
        <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-primary">Posts</h2>

            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-3">
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    className="rounded-lg border border-primary bg-primary px-3 py-2 text-sm text-primary shadow-xs"
                >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                    <option value="deleted">Deleted</option>
                </select>

                <select
                    value={formatFilter}
                    onChange={(e) => setFormatFilter(e.target.value as FormatFilter)}
                    className="rounded-lg border border-primary bg-primary px-3 py-2 text-sm text-primary shadow-xs"
                >
                    <option value="all">All Formats</option>
                    <option value="singles">Singles</option>
                    <option value="doubles">Doubles</option>
                </select>

                <input
                    type="text"
                    placeholder="Search by location..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="rounded-lg border border-primary bg-primary px-3 py-2 text-sm text-primary shadow-xs placeholder:text-placeholder"
                />
            </div>

            {/* Summary */}
            <p className="text-sm text-tertiary">
                {totalCount} post{totalCount !== 1 ? "s" : ""} found
            </p>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="size-6 animate-spin rounded-full border-2 border-border-secondary border-t-brand-solid" />
                </div>
            ) : error ? (
                <div className="flex flex-col items-center gap-4 py-16 text-center">
                    <p className="text-sm text-error-primary">{error}</p>
                    <Button size="sm" color="primary" onClick={fetchPosts}>
                        Retry
                    </Button>
                </div>
            ) : posts.length === 0 ? (
                <p className="py-16 text-center text-sm text-tertiary">No posts match your filters.</p>
            ) : (
                <>
                    {/* Desktop table */}
                    <div className="hidden overflow-x-auto md:block">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-secondary text-xs font-medium text-tertiary">
                                    <th className="px-3 py-3">Date</th>
                                    <th className="px-3 py-3">Location</th>
                                    <th className="px-3 py-3">Format</th>
                                    <th className="px-3 py-3">Cost</th>
                                    <th className="px-3 py-3">Status</th>
                                    <th className="px-3 py-3">Author</th>
                                    <th className="px-3 py-3">Spots</th>
                                    <th className="px-3 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {posts.map((post) => (
                                    <tr key={post.id} className="border-b border-secondary">
                                        <td className="px-3 py-3 text-secondary">{formatDate(post.game_date)}</td>
                                        <td className="px-3 py-3 text-primary">
                                            {editingId === post.id ? (
                                                <input
                                                    type="text"
                                                    value={editLocation}
                                                    onChange={(e) => setEditLocation(e.target.value)}
                                                    className="w-full rounded border border-primary bg-primary px-2 py-1 text-sm text-primary"
                                                />
                                            ) : (
                                                post.location ?? post.custom_court ?? "-"
                                            )}
                                        </td>
                                        <td className="px-3 py-3 capitalize text-secondary">{post.format ?? "-"}</td>
                                        <td className="px-3 py-3 text-secondary">
                                            {editingId === post.id ? (
                                                <input
                                                    type="number"
                                                    value={editCost}
                                                    onChange={(e) => setEditCost(e.target.value)}
                                                    className="w-20 rounded border border-primary bg-primary px-2 py-1 text-sm text-primary"
                                                />
                                            ) : post.cost != null ? (
                                                `$${post.cost}`
                                            ) : (
                                                "-"
                                            )}
                                        </td>
                                        <td className="px-3 py-3">{statusBadge(post.status)}</td>
                                        <td className="px-3 py-3 text-secondary">
                                            {post.users.first_name} {post.users.last_name}
                                        </td>
                                        <td className="px-3 py-3 text-secondary">{post.spots_total ?? "-"}</td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-2">
                                                {editingId === post.id ? (
                                                    <>
                                                        <Button size="xs" color="primary" onClick={saveEdit}>
                                                            Save
                                                        </Button>
                                                        <Button size="xs" color="secondary" onClick={cancelEdit}>
                                                            Cancel
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        {confirmingAction?.id === post.id ? (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-secondary">
                                                                    {confirmingAction.action === "delete" ? "Delete this post?" : "Expire this post?"}
                                                                </span>
                                                                <Button
                                                                    size="xs"
                                                                    color="primary-destructive"
                                                                    isLoading={actionLoading === post.id}
                                                                    onClick={() => confirmingAction.action === "delete" ? handleDelete(post.id) : handleExpire(post.id)}
                                                                >
                                                                    Confirm
                                                                </Button>
                                                                <Button size="xs" color="secondary" onClick={() => setConfirmingAction(null)}>
                                                                    Cancel
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <Button size="xs" color="secondary" onClick={() => startEdit(post)}>
                                                                    Edit
                                                                </Button>
                                                                {post.status === "active" && (
                                                                    <Button size="xs" color="secondary" onClick={() => setConfirmingAction({ id: post.id, action: "expire" })}>
                                                                        Expire
                                                                    </Button>
                                                                )}
                                                                {post.status !== "deleted" && (
                                                                    <Button size="xs" color="primary-destructive" onClick={() => setConfirmingAction({ id: post.id, action: "delete" })}>
                                                                        Delete
                                                                    </Button>
                                                                )}
                                                            </>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="flex flex-col gap-3 md:hidden">
                        {posts.map((post) => (
                            <div key={post.id} className="rounded-xl border border-secondary bg-primary p-4 shadow-xs">
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="text-sm font-medium text-primary">
                                        {post.location ?? post.custom_court ?? "Unknown"}
                                    </span>
                                    {statusBadge(post.status)}
                                </div>

                                <div className="mb-3 grid grid-cols-2 gap-y-1 text-sm">
                                    <span className="text-tertiary">Date</span>
                                    <span className="text-secondary">{formatDate(post.game_date)}</span>
                                    <span className="text-tertiary">Format</span>
                                    <span className="capitalize text-secondary">{post.format ?? "-"}</span>
                                    <span className="text-tertiary">Cost</span>
                                    <span className="text-secondary">{post.cost != null ? `$${post.cost}` : "-"}</span>
                                    <span className="text-tertiary">Spots</span>
                                    <span className="text-secondary">{post.spots_total ?? "-"}</span>
                                    <span className="text-tertiary">Author</span>
                                    <span className="text-secondary">
                                        {post.users.first_name} {post.users.last_name}
                                    </span>
                                </div>

                                {editingId === post.id ? (
                                    <div className="flex flex-col gap-2">
                                        <input
                                            type="text"
                                            value={editLocation}
                                            onChange={(e) => setEditLocation(e.target.value)}
                                            placeholder="Location"
                                            className="rounded border border-primary bg-primary px-2 py-1 text-sm text-primary"
                                        />
                                        <input
                                            type="number"
                                            value={editCost}
                                            onChange={(e) => setEditCost(e.target.value)}
                                            placeholder="Cost"
                                            className="rounded border border-primary bg-primary px-2 py-1 text-sm text-primary"
                                        />
                                        <div className="flex gap-2">
                                            <Button size="xs" color="primary" onClick={saveEdit}>
                                                Save
                                            </Button>
                                            <Button size="xs" color="secondary" onClick={cancelEdit}>
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {confirmingAction?.id === post.id ? (
                                            <>
                                                <span className="text-xs text-secondary">
                                                    {confirmingAction.action === "delete" ? "Delete?" : "Expire?"}
                                                </span>
                                                <Button
                                                    size="xs"
                                                    color="primary-destructive"
                                                    isLoading={actionLoading === post.id}
                                                    onClick={() => confirmingAction.action === "delete" ? handleDelete(post.id) : handleExpire(post.id)}
                                                >
                                                    Confirm
                                                </Button>
                                                <Button size="xs" color="secondary" onClick={() => setConfirmingAction(null)}>
                                                    Cancel
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <Button size="xs" color="secondary" onClick={() => startEdit(post)}>
                                                    Edit
                                                </Button>
                                                {post.status === "active" && (
                                                    <Button size="xs" color="secondary" onClick={() => setConfirmingAction({ id: post.id, action: "expire" })}>
                                                        Expire
                                                    </Button>
                                                )}
                                                {post.status !== "deleted" && (
                                                    <Button size="xs" color="primary-destructive" onClick={() => setConfirmingAction({ id: post.id, action: "delete" })}>
                                                        Delete
                                                    </Button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
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
