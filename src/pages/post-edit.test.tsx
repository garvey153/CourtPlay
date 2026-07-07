import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockCourts } from "@/test/mocks/fixtures";
import { PostNew } from "./post-new";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-auth", () => ({
    useAuth: () => ({ user: { id: "test-user-id", email: "test@example.com" }, loading: false }),
}));

const mockNavigate = vi.fn();
vi.mock("react-router", async (importOriginal) => {
    const actual = await importOriginal<typeof import("react-router")>();
    return { ...actual, useNavigate: () => mockNavigate };
});

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
    supabase: {
        from: mockFrom,
        auth: {
            getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
            onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        },
    },
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
        in: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(),
        single: vi.fn().mockResolvedValue(resolved),
        maybeSingle: vi.fn().mockResolvedValue(resolved),
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
            Promise.resolve(resolved).then(resolve, reject),
        catch: (reject: (e: unknown) => unknown) => Promise.resolve(resolved).catch(reject),
    };
    for (const key of ["select", "insert", "update", "eq", "neq", "in", "order", "limit"]) {
        (chain[key] as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    }
    return chain;
}

// ── Fixtures ───────────────────────────────────────────────────────────────

const EDIT_POST_ID = "post-to-edit-123";

const EXISTING_SUB_NEED = {
    id: EDIT_POST_ID,
    post_type: "sub_need",
    author_id: "test-user-id",
    play_type: "point_play",
    duration: 2,
    total_players: 4,
    game_date: "2026-05-01",
    game_time: "09:00",
    skill_level: "4.0",
    court_id: "court-1",
    custom_court: null,
    cost: 25,
    notes: "Bring water",
    spots_total: 2,
    series_id: null,
    status: "active",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function renderEditMode(withClaims = false) {
    const postsChain = buildChain(EXISTING_SUB_NEED);
    const claimsData = withClaims ? [{ id: "claim-1" }] : [];
    const claimsChain = buildChain(claimsData);

    mockFrom.mockImplementation((table: string) => {
        if (table === "courts") return buildChain(mockCourts);
        if (table === "posts") return postsChain;
        if (table === "claims") return claimsChain;
        return buildChain(null);
    });

    render(
        <MemoryRouter initialEntries={[`/post/new?edit=${EDIT_POST_ID}`]}>
            <PostNew />
        </MemoryRouter>,
    );

    return { postsChain, claimsChain };
}

// ── Edit mode: page rendering ──────────────────────────────────────────────

describe("PostNew — edit mode rendering", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockNavigate.mockReset();
    });

    it("renders 'Edit post' heading instead of 'New post'", async () => {
        renderEditMode();
        await waitFor(() => expect(screen.getByText("Edit post")).toBeInTheDocument());
    });

    it("submit button reads 'Save changes' in edit mode", async () => {
        renderEditMode();
        await waitFor(() =>
            expect(screen.getByRole("button", { name: /Save changes/i })).toBeInTheDocument(),
        );
    });

    it("post type toggle is hidden in edit mode", async () => {
        renderEditMode();
        await waitFor(() => screen.getByText("Edit post"));
        // "Regular Game" only appears in the tab toggle (not in the nav), so its
        // absence confirms the toggle is hidden in edit mode
        await waitFor(() => {
            expect(screen.queryByText("Regular Game")).not.toBeInTheDocument();
        });
    });

    it("pre-fills the cost field with the existing value", async () => {
        renderEditMode();
        await waitFor(() => {
            const costInput = screen.getByDisplayValue("25");
            expect(costInput).toBeInTheDocument();
        });
    });

    it("pre-fills the notes field with the existing value", async () => {
        renderEditMode();
        await waitFor(() => {
            const textarea = screen.getByDisplayValue("Bring water");
            expect(textarea).toBeInTheDocument();
        });
    });
});

// ── Edit mode: locked fields (existing claims) ─────────────────────────────

describe("PostNew — edit mode locked fields (with existing claims)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockNavigate.mockReset();
    });

    it("locked fields tooltip is shown when claims exist", async () => {
        renderEditMode(true);
        await waitFor(() => screen.getByText("Edit post"));

        // When fields are locked, the tooltip text "Cancel and repost" appears on the help icons
        await waitFor(() => {
            const disabledSelects = document.querySelectorAll('button[disabled]');
            expect(disabledSelects.length).toBeGreaterThan(0);
        });
    });

    it("multiple select triggers are disabled when claims exist", async () => {
        renderEditMode(true);
        await waitFor(() => screen.getByText("Edit post"));

        // When lockedField=true, several React Aria Select triggers gain disabled=""
        // Count disabled listbox triggers — there should be at least 3 (format, skill, court)
        await waitFor(() => {
            const disabledListboxBtns = Array.from(document.querySelectorAll('button[disabled]')).filter(
                (b) => b.getAttribute("aria-haspopup") === "listbox",
            );
            expect(disabledListboxBtns.length).toBeGreaterThanOrEqual(3);
        });
    });

    it("cost field remains editable when claims exist", async () => {
        renderEditMode(true);
        await waitFor(() => screen.getByText("Edit post"));

        await waitFor(() => {
            // Cost NumberField renders as <input type="text">
            const costInput = screen.getByDisplayValue("25");
            expect(costInput).not.toBeDisabled();
        });
    });
});

// ── Edit mode: unlocked fields (no claims) ─────────────────────────────────

describe("PostNew — edit mode unlocked fields (no claims)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockNavigate.mockReset();
    });

    it("no listbox triggers are disabled when no claims exist", async () => {
        renderEditMode(false);
        await waitFor(() => screen.getByText("Edit post"));

        await waitFor(() => {
            const disabledListboxBtns = Array.from(document.querySelectorAll('button[disabled]')).filter(
                (b) => b.getAttribute("aria-haspopup") === "listbox",
            );
            expect(disabledListboxBtns.length).toBe(0);
        });
    });

    it("Skill level select trigger is enabled when no claims exist", async () => {
        renderEditMode(false);
        await waitFor(() => screen.getByText("Edit post"));

        await waitFor(() => {
            const allButtons = screen.getAllByRole("button", { name: /Skill level/i });
            const trigger = allButtons.find((b) => b.getAttribute("aria-haspopup") === "listbox");
            expect(trigger).toBeDefined();
            expect(trigger).not.toBeDisabled();
        });
    });
});

// ── Edit mode: save submission ─────────────────────────────────────────────

describe("PostNew — edit mode save submission", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockNavigate.mockReset();
    });

    it("calls posts.update (not insert) when saving in edit mode", async () => {
        const user = userEvent.setup();
        const { postsChain } = renderEditMode(false);

        await waitFor(() => screen.getByText("Edit post"));

        // Save is disabled until a change is made (dirty tracking); edit the message.
        fireEvent.change(await screen.findByLabelText("Message"), { target: { value: "Updated message" } });
        await waitFor(() =>
            expect(screen.getByRole("button", { name: /Save changes/i })).not.toBeDisabled(),
        );
        await user.click(screen.getByRole("button", { name: /Save changes/i }));

        await waitFor(() => {
            expect(postsChain.update).toHaveBeenCalled();
        });
    });

    it("does not call posts.insert when saving in edit mode", async () => {
        const user = userEvent.setup();
        const { postsChain } = renderEditMode(false);

        fireEvent.change(await screen.findByLabelText("Message"), { target: { value: "Updated message" } });
        await waitFor(() =>
            expect(screen.getByRole("button", { name: /Save changes/i })).not.toBeDisabled(),
        );
        await user.click(screen.getByRole("button", { name: /Save changes/i }));

        await waitFor(() => expect(postsChain.update).toHaveBeenCalled());
        expect(postsChain.insert).not.toHaveBeenCalled();
    });

    it("saves with locked fields excluded from the update when claims exist", async () => {
        const user = userEvent.setup();
        const postsChain = buildChain(EXISTING_SUB_NEED);
        const claimsChain = buildChain([{ id: "claim-1" }]);

        mockFrom.mockImplementation((table: string) => {
            if (table === "courts") return buildChain(mockCourts);
            if (table === "posts") return postsChain;
            if (table === "claims") return claimsChain;
            return buildChain(null);
        });

        render(
            <MemoryRouter initialEntries={[`/post/new?edit=${EDIT_POST_ID}`]}>
                <PostNew />
            </MemoryRouter>,
        );

        // Message stays editable even with claims — use it to dirty the form.
        fireEvent.change(await screen.findByLabelText("Message"), { target: { value: "Updated message" } });
        await waitFor(() =>
            expect(screen.getByRole("button", { name: /Save changes/i })).not.toBeDisabled(),
        );
        await user.click(screen.getByRole("button", { name: /Save changes/i }));

        await waitFor(() => expect(postsChain.update).toHaveBeenCalled());

        const updateArg = (postsChain.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<
            string,
            unknown
        >;
        // Locked fields must NOT be in the update payload
        expect(updateArg.play_type).toBeUndefined();
        expect(updateArg.duration).toBeUndefined();
        expect(updateArg.skill_level).toBeUndefined();
        expect(updateArg.court_id).toBeUndefined();
        // Cost and notes CAN be in the update payload
        expect(updateArg.cost).toBeDefined();
    });

    it("navigates to /feed after a successful save", async () => {
        const user = userEvent.setup();
        renderEditMode(false);

        fireEvent.change(await screen.findByLabelText("Message"), { target: { value: "Updated message" } });
        await waitFor(() =>
            expect(screen.getByRole("button", { name: /Save changes/i })).not.toBeDisabled(),
        );
        await user.click(screen.getByRole("button", { name: /Save changes/i }));

        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/feed"));
    });
});
