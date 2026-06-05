import { http, HttpResponse } from "msw";
import { mockCourts, makePost } from "./fixtures";

const SUPABASE_URL = "http://localhost:54321";

// In-memory state for tests — reset between tests via server.resetHandlers()
let activePosts: ReturnType<typeof makePost>[] = [];
let customCourtPlaymissions: Record<string, unknown>[] = [];

/** Replace the mock post store (call this in tests that need specific post state) */
export function seedPosts(posts: ReturnType<typeof makePost>[]) {
    activePosts = [...posts];
}

/** Replace the custom court store */
export function seedCustomCourts(rows: Record<string, unknown>[]) {
    customCourtPlaymissions = [...rows];
}

/** Reset all in-memory state */
export function resetDb() {
    activePosts = [];
    customCourtPlaymissions = [];
}

function parseSupabaseFilter(param: string | null): string | null {
    if (!param) return null;
    // Supabase encodes filters as "eq.value", "neq.value", etc.
    return param.replace(/^eq\./, "");
}

export const handlers = [
    // ── Courts ─────────────────────────────────────────────────────────────
    http.get(`${SUPABASE_URL}/rest/v1/courts`, () => {
        return HttpResponse.json(mockCourts);
    }),

    // ── Posts GET ──────────────────────────────────────────────────────────
    http.get(`${SUPABASE_URL}/rest/v1/posts`, ({ request }) => {
        const url = new URL(request.url);
        const authorId = parseSupabaseFilter(url.searchParams.get("author_id"));
        const status = parseSupabaseFilter(url.searchParams.get("status"));

        let posts = [...activePosts];
        if (authorId) posts = posts.filter((p) => p.author_id === authorId);
        if (status) posts = posts.filter((p) => p.status === status);

        return HttpResponse.json(posts);
    }),

    // ── Posts POST (insert) ────────────────────────────────────────────────
    http.post(`${SUPABASE_URL}/rest/v1/posts`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown> | Record<string, unknown>[];
        const rows = Array.isArray(body) ? body : [body];
        const inserted = rows.map((row) => makePost(row));
        activePosts.push(...inserted);

        // Supabase returns array when prefer=return=representation, single obj otherwise
        const prefer = request.headers.get("prefer") ?? "";
        if (prefer.includes("return=representation")) {
            return HttpResponse.json(inserted.length === 1 ? inserted[0] : inserted, { status: 201 });
        }
        return HttpResponse.json(inserted.length === 1 ? inserted[0] : inserted, { status: 201 });
    }),

    // ── Posts PATCH (update) ───────────────────────────────────────────────
    http.patch(`${SUPABASE_URL}/rest/v1/posts`, async ({ request }) => {
        const url = new URL(request.url);
        const id = parseSupabaseFilter(url.searchParams.get("id"));
        const body = (await request.json()) as Record<string, unknown>;

        const idx = activePosts.findIndex((p) => p.id === id);
        if (idx >= 0) {
            activePosts[idx] = { ...activePosts[idx], ...body };
            return HttpResponse.json(activePosts[idx]);
        }
        return HttpResponse.json({}, { status: 404 });
    }),

    // ── Custom court submissions GET ───────────────────────────────────────
    http.get(`${SUPABASE_URL}/rest/v1/custom_court_submissions`, ({ request }) => {
        const url = new URL(request.url);
        const courtName = parseSupabaseFilter(url.searchParams.get("court_name"));
        const rows = courtName
            ? customCourtPlaymissions.filter((r) => r.court_name === courtName)
            : customCourtPlaymissions;
        return HttpResponse.json(rows);
    }),

    // ── Custom court submissions POST ──────────────────────────────────────
    http.post(`${SUPABASE_URL}/rest/v1/custom_court_submissions`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        const row = { id: crypto.randomUUID(), ...body };
        customCourtPlaymissions.push(row);
        return HttpResponse.json(row, { status: 201 });
    }),

    // ── Custom court submissions PATCH (update count) ──────────────────────
    http.patch(`${SUPABASE_URL}/rest/v1/custom_court_submissions`, async ({ request }) => {
        const url = new URL(request.url);
        const id = parseSupabaseFilter(url.searchParams.get("id"));
        const body = (await request.json()) as Record<string, unknown>;

        const idx = customCourtPlaymissions.findIndex((r) => r.id === id);
        if (idx >= 0) {
            customCourtPlaymissions[idx] = { ...customCourtPlaymissions[idx], ...body };
            return HttpResponse.json(customCourtPlaymissions[idx]);
        }
        return HttpResponse.json({}, { status: 404 });
    }),
];
