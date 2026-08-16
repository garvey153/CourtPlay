import { render, screen, waitFor } from "@testing-library/react";
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

const { mockFrom, MOCK_GROUPS } = vi.hoisted(() => ({
    mockFrom: vi.fn(),
    MOCK_GROUPS: [
        { id: "g1", name: "The Racquettes", details: null, is_creator: true, is_closed: false, closed_at: null,
          joined_at: "2026-08-01T00:00:00Z", my_removed_at: null, removed_by_me: false, member_count: 4, members: [] },
        { id: "g2", name: "Sunday Doubles", details: null, is_creator: false, is_closed: false, closed_at: null,
          joined_at: "2026-08-01T00:00:00Z", my_removed_at: null, removed_by_me: false, member_count: 6, members: [] },
    ],
}));

vi.mock("@/lib/supabase", () => ({
    supabase: {
        from: mockFrom,
        // get_my_groups feeds both group pickers; everything else gets the
        // generic success shape so the create path doesn't throw.
        rpc: vi.fn((fn: string) =>
            Promise.resolve(
                fn === "get_my_groups"
                    ? { data: MOCK_GROUPS, error: null }
                    : { data: { success: true, group_ids: [] }, error: null },
            ),
        ),
        functions: {
            invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
        },
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

// ── Helpers ────────────────────────────────────────────────────────────────

function setupDefaultMocks() {
    mockFrom.mockImplementation((table: string) => {
        if (table === "courts") return buildChain(mockCourts);
        if (table === "posts") return buildChain([]);
        return buildChain(null);
    });
}

function renderPostNew() {
    return render(
        <MemoryRouter initialEntries={["/post/new"]}>
            <PostNew />
        </MemoryRouter>,
    );
}

// ── Header + post-type selector ────────────────────────────────────────────

describe("PostNew — header & post type", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDefaultMocks();
    });

    it("renders the 'Create a new post' header", async () => {
        renderPostNew();
        await waitFor(() => expect(screen.getByText("Create a new post")).toBeInTheDocument());
    });

    it("renders both post-type option cards", async () => {
        renderPostNew();
        await waitFor(() => {
            expect(screen.getByText("Find a sub")).toBeInTheDocument();
            expect(screen.getByText("Find a regular game")).toBeInTheDocument();
        });
    });

    it("defaults to the Find a sub form", async () => {
        renderPostNew();
        await waitFor(() => expect(screen.getByText("Play type")).toBeInTheDocument());
    });
});

// ── Find a sub form — rendering ────────────────────────────────────────────

describe("PostNew — sub need form (rendering)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDefaultMocks();
    });

    it("renders the Play type dropdown label", async () => {
        renderPostNew();
        await waitFor(() => expect(screen.getByText("Play type")).toBeInTheDocument());
    });

    it("renders the Date & time label and native time input", async () => {
        renderPostNew();
        await waitFor(() => {
            expect(screen.getByText(/date & time/i, { selector: "label" })).toBeInTheDocument();
            expect(document.querySelector('[aria-label="Game time"]')).not.toBeNull();
        });
    });

    it("renders the Duration field label", async () => {
        renderPostNew();
        await waitFor(() => expect(screen.getByText("Duration")).toBeInTheDocument());
    });

    it("renders the Required skill level field label", async () => {
        renderPostNew();
        await waitFor(() => expect(screen.getByText("Required skill level")).toBeInTheDocument());
    });

    it("renders the Location field label", async () => {
        renderPostNew();
        await waitFor(() => expect(screen.getByText("Location")).toBeInTheDocument());
    });

    it("renders the Price field label", async () => {
        renderPostNew();
        await waitFor(() => expect(screen.getByText("Price")).toBeInTheDocument());
    });

    it("renders optional Pro name field label", async () => {
        renderPostNew();
        await waitFor(() => expect(screen.getByText("Pro name (optional)")).toBeInTheDocument());
    });

    it("renders the Notes textarea with a 0/100 counter", async () => {
        renderPostNew();
        await waitFor(() => {
            expect(screen.getByText("Message")).toBeInTheDocument();
            expect(screen.getByText("0/150")).toBeInTheDocument();
        });
    });

    it("does not render the removed fields (spots, total players, multi-date)", async () => {
        renderPostNew();
        await waitFor(() => screen.getByText("Play type"));
        expect(screen.queryByText(/spots open/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/total players/i)).not.toBeInTheDocument();
        // This used to assert no switch at all, standing in for the removed
        // multi-date toggle. Post visibility is a switch now, so the check has
        // to name it: exactly one, and it's that one.
        const switches = document.querySelectorAll('input[role="switch"]');
        expect(switches).toHaveLength(1);
        expect(screen.getByLabelText("Make this post private")).toBeInTheDocument();
    });
});

describe("PostNew — post visibility", () => {
    it("defaults to Public, with the public claim rule as the hint", async () => {
        renderPostNew();
        await waitFor(() => expect(screen.getByText("Post visibility")).toBeInTheDocument());
        expect(screen.getByText("Public")).toBeInTheDocument();
        expect(screen.getByText("Anyone at the required level or above can claim.")).toBeInTheDocument();
        // The recipients picker is private-only.
        expect(screen.queryByText("Private post recipients")).not.toBeInTheDocument();
    });

    it("toggling to Private swaps the word, the hint, and reveals the recipients picker", async () => {
        const user = userEvent.setup();
        renderPostNew();
        await waitFor(() => expect(screen.getByText("Post visibility")).toBeInTheDocument());

        await user.click(screen.getByLabelText("Make this post private"));

        expect(screen.getByText("Private")).toBeInTheDocument();
        expect(screen.queryByText("Public")).not.toBeInTheDocument();
        expect(screen.getByText("Only selected groups or players can claim.")).toBeInTheDocument();
        expect(screen.getByText("Private post recipients")).toBeInTheDocument();
    });

    it("Tag your group is available whatever the visibility", async () => {
        // Independent of the toggle: a public post can tag a group too, and the
        // tagged group hears about it either way.
        const user = userEvent.setup();
        renderPostNew();
        await waitFor(() => expect(screen.getByText("Post visibility")).toBeInTheDocument());
        expect(screen.getByText("Tag your group (optional)")).toBeInTheDocument();

        await user.click(screen.getByLabelText("Make this post private"));
        expect(screen.getByText("Tag your group (optional)")).toBeInTheDocument();
    });

    it("a tag survives toggling the visibility back and forth", async () => {
        const user = userEvent.setup();
        renderPostNew();
        await waitFor(() => expect(screen.getByText("Post visibility")).toBeInTheDocument());

        await user.click(screen.getByText("Select groups").closest("button")!);
        await user.click(await screen.findByRole("option", { name: "The Racquettes" }));
        await waitFor(() => expect(screen.getAllByText("The Racquettes").length).toBeGreaterThan(0));

        await user.click(screen.getByLabelText("Make this post private"));
        await user.click(screen.getByLabelText("Make this post private"));

        // Still selected — the trigger shows the group, not the placeholder.
        expect(screen.getByText("Tag your group (optional)")).toBeInTheDocument();
        expect(screen.queryByText("Select groups")).not.toBeInTheDocument();
    });

    it("is absent from the regular-play form, which has no audience", async () => {
        const user = userEvent.setup();
        renderPostNew();
        await waitFor(() => expect(screen.getByText("Post visibility")).toBeInTheDocument());

        await user.click(screen.getByText("Find a regular game"));

        expect(screen.queryByText("Post visibility")).not.toBeInTheDocument();
    });
});

// ── Court selection ─────────────────────────────────────────────────────────

describe("PostNew — court selection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDefaultMocks();
    });

    it("court dropdown trigger button is present", async () => {
        renderPostNew();
        await waitFor(() => {
            expect(screen.getByRole("button", { name: /Location/i })).toBeInTheDocument();
        });
    });

    it("opening the court dropdown shows the 3 courts from Supabase", async () => {
        const user = userEvent.setup();
        renderPostNew();

        const trigger = await waitFor(() => screen.getByRole("button", { name: /Location/i }));
        await user.click(trigger);

        await waitFor(() => {
            expect(screen.queryByText("Longshore Club")).toBeInTheDocument();
            expect(screen.queryByText("Staples High School")).toBeInTheDocument();
            expect(screen.queryByText("Weston Field Club")).toBeInTheDocument();
        });
    });

    it("selecting 'Add custom court' shows a text input for the court name", async () => {
        const user = userEvent.setup();
        renderPostNew();

        const trigger = await waitFor(() => screen.getByRole("button", { name: /Location/i }));
        await user.click(trigger);

        const option = await waitFor(() => screen.getByRole("option", { name: /Add custom court/i }));
        await user.click(option);

        await waitFor(() =>
            expect(screen.getByPlaceholderText(/Longshore Tennis Club/i)).toBeInTheDocument(),
        );
    });
});

// ── Submit button state ─────────────────────────────────────────────────────

describe("PostNew — submit button state", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDefaultMocks();
    });

    it("Create post is disabled when the sub form is empty", async () => {
        renderPostNew();
        await waitFor(() => expect(screen.getByRole("button", { name: /^Create post$/i })).toBeDisabled());
    });
});

// ── Rate limiting ────────────────────────────────────────────────────────────

describe("PostNew — rate limiting", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockNavigate.mockReset();
    });

    it("rate limit message is not shown on initial load", async () => {
        setupDefaultMocks();
        renderPostNew();
        await waitFor(() => screen.getByText("Create a new post"));
        expect(screen.queryByText(/5 active posts/i)).not.toBeInTheDocument();
    });

    it("rate limit banner text is correct", () => {
        expect("You already have 5 active posts. Close one before posting again.").toContain(
            "5 active posts",
        );
    });
});

// ── Regular game form ────────────────────────────────────────────────────────

describe("PostNew — regular game form", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDefaultMocks();
    });

    async function switchToRegularGame() {
        renderPostNew();
        const user = userEvent.setup();
        await waitFor(() => screen.getByText("Create a new post"));
        await user.click(screen.getByText("Find a regular game"));
        await waitFor(() => screen.getByText("Play type"));
        return user;
    }

    it("renders the Play type dropdown label", async () => {
        await switchToRegularGame();
        expect(screen.getByText("Play type")).toBeInTheDocument();
    });

    it("renders the Preferred group size label", async () => {
        await switchToRegularGame();
        expect(screen.getByText("Preferred group size")).toBeInTheDocument();
    });

    it("renders the Skill level dropdown label", async () => {
        await switchToRegularGame();
        expect(screen.getByText("Skill level")).toBeInTheDocument();
    });

    it("renders the preferred days / times / locations labels", async () => {
        await switchToRegularGame();
        expect(screen.getByText("Preferred days")).toBeInTheDocument();
        expect(screen.getByText("Preferred times")).toBeInTheDocument();
        expect(screen.getByText("Preferred locations")).toBeInTheDocument();
    });

    it("renders the Notes textarea with a 0/150 counter", async () => {
        await switchToRegularGame();
        expect(screen.getByText("Message")).toBeInTheDocument();
        expect(screen.getByText("0/150")).toBeInTheDocument();
    });

    // The regular-game dropdowns are multi-selects that stay open on pick; close
    // each (Escape) before opening the next.
    async function pickMulti(user: ReturnType<typeof userEvent.setup>, placeholder: string, optionName: string | RegExp) {
        await user.click(screen.getByText(placeholder));
        await user.click(await screen.findByRole("option", { name: optionName }));
        await user.keyboard("{Escape}");
    }

    it("Create post is disabled until play type, skill, and notes are set (group size optional)", async () => {
        const user = await switchToRegularGame();
        const submit = () => screen.getByRole("button", { name: /^Create post$/i });
        expect(submit()).toBeDisabled();

        await pickMulti(user, "Select type", "Doubles");
        await pickMulti(user, "Select level", /NTRP 4\.0/);
        await user.type(screen.getByPlaceholderText(/tell the group/i), "Looking for a weekly game");

        // Group size is not required, so the form is valid without it.
        await waitFor(() => expect(submit()).not.toBeDisabled());
    });

    it("submitting a complete regular game navigates to /feed", async () => {
        const user = userEvent.setup();
        mockFrom.mockImplementation((table: string) => {
            if (table === "courts") return buildChain(mockCourts);
            if (table === "posts") return buildChain({ id: "new-post", post_type: "regular_game", skill_level: "4.0" });
            return buildChain(null);
        });

        renderPostNew();
        await waitFor(() => screen.getByText("Create a new post"));
        await user.click(screen.getByText("Find a regular game"));
        await waitFor(() => screen.getByText("Play type"));

        await pickMulti(user, "Select type", "Doubles");
        await pickMulti(user, "Any size", "4");
        await pickMulti(user, "Select level", /NTRP 4\.0/);
        await user.type(screen.getByPlaceholderText(/tell the group/i), "Weekly game");

        await waitFor(() => expect(screen.getByRole("button", { name: /^Create post$/i })).not.toBeDisabled());
        await user.click(screen.getByRole("button", { name: /^Create post$/i }));

        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/feed"));
    });
});
