/**
 * A fake Supabase client for the demo screens behind the tutorial screenshots.
 *
 * The screens render the REAL pages — Feed, Activity, Profile, the post form —
 * rather than compositions of their parts, because the designs show whole
 * screens and a composition is always structurally thinner than the page it
 * imitates. That is what put "missing elements" in four screenshots.
 *
 * Rendering the real pages means answering what they fetch. The read surface is
 * small and bounded:
 *
 *   courts                       post form's court picker
 *   get_my_groups                post form's audience + profile's group list
 *   get_profile                  profile
 *   get_my_posts_with_claims     activity, created tab
 *   get_my_claims_with_posts     activity, answered tab
 *   get_feed                     feed
 *
 * Everything else resolves empty, and every write is a no-op — nothing here is
 * ever interacted with, only photographed.
 *
 * Reached two ways, and both must agree or the fingerprint would police a tree
 * the screenshot never showed: the browser gets it through a Vite alias that
 * only exists when DEMO=1 (see vite.config.ts), and the jsdom test mocks the
 * same module path to this file.
 */
import {
    DEMO_CLAIMED_POST,
    DEMO_GROUPS,
    DEMO_MY_CLAIMS,
    DEMO_CREATED_POSTS,
    DEMO_PROFILE,
    DEMO_PROFILE_PAGE,
    DEMO_REGULAR_POST,
    DEMO_SUB_POST,
} from "./fixtures";

/**
 * Which screen is being photographed. The feed must not carry the pending-claim
 * banner that Activity needs, or the notification stack covers the posts the
 * slide is about — so the same RPC answers differently per screen.
 */
const screen = typeof location !== "undefined" ? new URLSearchParams(location.search).get("screen") : null;
const onActivity = screen === "activity";

const RPC_DATA: Record<string, unknown> = {
    get_feed: [DEMO_SUB_POST, DEMO_REGULAR_POST, DEMO_CLAIMED_POST],
    get_my_groups: DEMO_GROUPS,
    get_profile: DEMO_PROFILE_PAGE,
    get_my_posts_with_claims: onActivity ? DEMO_CREATED_POSTS : [],
    get_my_claims_with_posts: onActivity ? DEMO_MY_CLAIMS : [],
    get_post_audience: [],
    get_my_tagged_posts: [],
    search_users: [],
    push_prompt_eligible: false,
    am_i_invited: true,
};

const TABLE_DATA: Record<string, unknown[]> = {
    courts: [
        { id: "court-1", name: "Longshore Club", area: "Westport", active: true },
        { id: "court-2", name: "Staples High School", area: "Westport", active: true },
        { id: "court-3", name: "Compo Beach Courts", area: "Westport", active: true },
    ],
    posts: [],
    claims: [],
};

/** Chainable and thenable, so any query shape the pages build resolves. */
function query(rows: unknown[]) {
    const result = { data: rows, error: null };
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "neq", "in", "is", "not", "gte", "lte", "gt", "lt", "order", "limit", "range", "ilike", "or", "filter", "update", "insert", "upsert", "delete"]) {
        chain[m] = () => chain;
    }
    chain.single = async () => ({ data: rows[0] ?? null, error: null });
    chain.maybeSingle = async () => ({ data: rows[0] ?? null, error: null });
    chain.then = (onFulfilled: (v: typeof result) => unknown) => Promise.resolve(result).then(onFulfilled);
    return chain;
}

export const supabase = {
    auth: {
        getSession: async () => ({ data: { session: { user: { id: DEMO_PROFILE.id } } } }),
        getUser: async () => ({ data: { user: { id: DEMO_PROFILE.id } } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signOut: async () => ({}),
    },
    rpc: async (name: string) => ({ data: RPC_DATA[name] ?? null, error: null }),
    from: (table: string) => query(TABLE_DATA[table] ?? []),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
    storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
};
