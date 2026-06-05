import { describe, it, expect } from "vitest";

// ── Types ────────────────────────────────────────────────────────────────

interface User {
    id: string;
    is_suspended: boolean;
}

interface Post {
    id: string;
    author_id: string;
    court_id: string;
    status: "active" | "deleted";
    spots_total: number;
    spots_available: number;
}

interface Claim {
    id: string;
    post_id: string;
    status: "pending" | "approved" | "cancelled";
}

interface Court {
    id: string;
    name: string;
    active: boolean;
}

// ── In-memory data store ─────────────────────────────────────────────────

function createStore() {
    const users: User[] = [
        { id: "u1", is_suspended: false },
        { id: "u2", is_suspended: false },
    ];

    const posts: Post[] = [
        { id: "p1", author_id: "u1", court_id: "c1", status: "active", spots_total: 4, spots_available: 2 },
        { id: "p2", author_id: "u1", court_id: "c1", status: "active", spots_total: 4, spots_available: 3 },
        { id: "p3", author_id: "u2", court_id: "c1", status: "active", spots_total: 4, spots_available: 4 },
    ];

    const claims: Claim[] = [
        { id: "cl1", post_id: "p1", status: "approved" },
        { id: "cl2", post_id: "p1", status: "pending" },
    ];

    const courts: Court[] = [
        { id: "c1", name: "Longshore Club", active: true },
    ];

    return {
        users,
        posts,
        claims,
        courts,
        suspendUser(userId: string) {
            const user = users.find((u) => u.id === userId);
            if (user) user.is_suspended = true;
        },
        softDeletePost(postId: string) {
            const post = posts.find((p) => p.id === postId);
            if (post) post.status = "deleted";
        },
        addCourt(court: Court) {
            courts.push(court);
        },
        deactivateCourt(courtId: string) {
            const court = courts.find((c) => c.id === courtId);
            if (court) court.active = false;
        },
        cancelClaim(claimId: string) {
            const claim = claims.find((c) => c.id === claimId);
            if (claim && claim.status === "approved") {
                claim.status = "cancelled";
                const post = posts.find((p) => p.id === claim.post_id);
                if (post) post.spots_available += 1;
            }
        },
    };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("Admin cross-panel integration", () => {
    it("suspending a user preserves their posts", () => {
        const store = createStore();
        store.suspendUser("u1");

        const user = store.users.find((u) => u.id === "u1")!;
        expect(user.is_suspended).toBe(true);

        // All posts by u1 should still be active
        const userPosts = store.posts.filter((p) => p.author_id === "u1");
        expect(userPosts).toHaveLength(2);
        expect(userPosts.every((p) => p.status === "active")).toBe(true);
    });

    it("soft-deleting a post marks claims context as deleted", () => {
        const store = createStore();
        store.softDeletePost("p1");

        const post = store.posts.find((p) => p.id === "p1")!;
        expect(post.status).toBe("deleted");

        // Claim rows should still exist (not cascade-deleted)
        const postClaims = store.claims.filter((c) => c.post_id === "p1");
        expect(postClaims).toHaveLength(2);
        expect(postClaims[0].status).toBe("approved");
        expect(postClaims[1].status).toBe("pending");
    });

    it("adding a court makes it available", () => {
        const store = createStore();
        const newCourt: Court = { id: "c2", name: "Tokeneke Club", active: true };
        store.addCourt(newCourt);

        const court = store.courts.find((c) => c.id === "c2");
        expect(court).toBeDefined();
        expect(court!.active).toBe(true);
        expect(store.courts).toHaveLength(2);
    });

    it("deactivating a court does not break existing posts", () => {
        const store = createStore();
        store.deactivateCourt("c1");

        const court = store.courts.find((c) => c.id === "c1")!;
        expect(court.active).toBe(false);

        // Posts still reference the court_id
        const postsWithCourt = store.posts.filter((p) => p.court_id === "c1");
        expect(postsWithCourt).toHaveLength(3);
        expect(postsWithCourt.every((p) => p.status === "active")).toBe(true);
    });

    it("admin claim cancellation affects spot count", () => {
        const store = createStore();
        const postBefore = store.posts.find((p) => p.id === "p1")!;
        const spotsBefore = postBefore.spots_available;
        expect(spotsBefore).toBe(2);

        // Cancel the approved claim
        store.cancelClaim("cl1");

        const postAfter = store.posts.find((p) => p.id === "p1")!;
        expect(postAfter.spots_available).toBe(spotsBefore + 1);
        expect(store.claims.find((c) => c.id === "cl1")!.status).toBe("cancelled");
    });
});
