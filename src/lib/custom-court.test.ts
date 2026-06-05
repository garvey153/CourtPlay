import { beforeEach, describe, expect, it, vi } from "vitest";
import { ALERT_THRESHOLD, upsertCustomCourt } from "./custom-court";

// ── Mocks ──────────────────────────────────────────────────────────────────

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
    supabase: { from: mockFrom },
}));

// ── Chain builder ──────────────────────────────────────────────────────────

function buildChain(data: unknown, error: unknown = null) {
    const resolved = { data, error };
    const chain: Record<string, unknown> = {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        eq: vi.fn(),
        neq: vi.fn(),
        maybeSingle: vi.fn().mockResolvedValue(resolved),
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
            Promise.resolve(resolved).then(resolve, reject),
        catch: (reject: (e: unknown) => unknown) => Promise.resolve(resolved).catch(reject),
    };
    for (const key of ["select", "insert", "update", "eq", "neq"]) {
        (chain[key] as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    }
    return chain;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("upsertCustomCourt — new court name", () => {
    beforeEach(() => vi.clearAllMocks());

    it("inserts a new row when the court name has never been submitted", async () => {
        const chain = buildChain(null); // maybeSingle returns null = no existing row
        mockFrom.mockReturnValue(chain);

        await upsertCustomCourt("Brand New Club");

        expect(chain.insert).toHaveBeenCalledWith(
            expect.objectContaining({ court_name: "Brand New Club", submission_count: 1 }),
        );
    });

    it("sets alerted to false on the first insert", async () => {
        const chain = buildChain(null);
        mockFrom.mockReturnValue(chain);

        await upsertCustomCourt("Brand New Club");

        const insertArg = (chain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<
            string,
            unknown
        >;
        expect(insertArg.alerted).toBe(false);
    });

    it("sets submission_count to 1 on the first insert", async () => {
        const chain = buildChain(null);
        mockFrom.mockReturnValue(chain);

        await upsertCustomCourt("First Time Club");

        const insertArg = (chain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<
            string,
            unknown
        >;
        expect(insertArg.submission_count).toBe(1);
    });
});

describe("upsertCustomCourt — existing court name", () => {
    beforeEach(() => vi.clearAllMocks());

    it("increments submission_count to 2 on the second submission", async () => {
        const existing = { id: "row-1", submission_count: 1, alerted: false };
        const chain = buildChain(existing);
        mockFrom.mockReturnValue(chain);

        await upsertCustomCourt("Repeated Club");

        const updateArg = (chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<
            string,
            unknown
        >;
        expect(updateArg.submission_count).toBe(2);
    });

    it("does not set alerted=true when below the threshold", async () => {
        const existing = { id: "row-1", submission_count: 1, alerted: false };
        const chain = buildChain(existing);
        mockFrom.mockReturnValue(chain);

        await upsertCustomCourt("Repeated Club");

        const updateArg = (chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<
            string,
            unknown
        >;
        expect(updateArg.alerted).toBe(false);
    });

    it(`sets alerted=true when submission_count reaches ALERT_THRESHOLD (${ALERT_THRESHOLD})`, async () => {
        // submission_count is ALERT_THRESHOLD-1; after increment it hits the threshold
        const existing = {
            id: "row-2",
            submission_count: ALERT_THRESHOLD - 1,
            alerted: false,
        };
        const chain = buildChain(existing);
        mockFrom.mockReturnValue(chain);

        await upsertCustomCourt("Popular Club");

        const updateArg = (chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<
            string,
            unknown
        >;
        expect(updateArg.submission_count).toBe(ALERT_THRESHOLD);
        expect(updateArg.alerted).toBe(true);
    });

    it("does not flip alerted back to true if already alerted", async () => {
        // Already past threshold and alerted
        const existing = { id: "row-3", submission_count: ALERT_THRESHOLD + 1, alerted: true };
        const chain = buildChain(existing);
        mockFrom.mockReturnValue(chain);

        await upsertCustomCourt("Already Alerted Club");

        const updateArg = (chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<
            string,
            unknown
        >;
        expect(updateArg.alerted).toBe(true); // stays true, not re-flagged
    });

    it("updates last_submitted_at on every increment", async () => {
        const existing = { id: "row-4", submission_count: 1, alerted: false };
        const chain = buildChain(existing);
        mockFrom.mockReturnValue(chain);

        const before = Date.now();
        await upsertCustomCourt("Time Check Club");
        const after = Date.now();

        const updateArg = (chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<
            string,
            unknown
        >;
        const ts = new Date(updateArg.last_submitted_at as string).getTime();
        expect(ts).toBeGreaterThanOrEqual(before - 100);
        expect(ts).toBeLessThanOrEqual(after + 100);
    });
});

describe("ALERT_THRESHOLD constant", () => {
    it("is 3", () => {
        expect(ALERT_THRESHOLD).toBe(3);
    });
});
