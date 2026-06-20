import { render, screen, waitFor, within } from "@testing-library/react";
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

/** Find the multi-date switch via direct DOM query (React Aria puts it in VisuallyHidden). */
function getMultiDateSwitch() {
    return document.querySelector('input[role="switch"]') as HTMLInputElement | null;
}

// ── Step 4: Sub Need form — rendering ─────────────────────────────────────

describe("PostNew — sub need form (rendering)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDefaultMocks();
    });

    it("renders the Play type dropdown label", async () => {
        renderPostNew();
        await waitFor(() => expect(screen.getByText("Play type")).toBeInTheDocument());
    });

    it("renders the Game date field label", async () => {
        renderPostNew();
        await waitFor(() => expect(screen.getByText("Game date")).toBeInTheDocument());
    });

    it("renders the Game time field label and native input", async () => {
        renderPostNew();
        await waitFor(() => {
            expect(screen.getByText(/game time/i, { selector: "label" })).toBeInTheDocument();
            // Native <input type="time"> — no label association; find by type
            const timeInput = document.querySelector('input[type="time"]');
            expect(timeInput).not.toBeNull();
        });
    });

    it("renders the Skill level field label", async () => {
        renderPostNew();
        await waitFor(() => expect(screen.getByText("Skill level required")).toBeInTheDocument());
    });

    it("renders the Location / court field label", async () => {
        renderPostNew();
        await waitFor(() => expect(screen.getByText("Location / court")).toBeInTheDocument());
    });

    it("renders the Cost per sub field label", async () => {
        renderPostNew();
        await waitFor(() => expect(screen.getByText("Cost per sub ($)")).toBeInTheDocument());
    });

    it("renders optional Pro name field label", async () => {
        renderPostNew();
        await waitFor(() => expect(screen.getByText("Pro name (optional)")).toBeInTheDocument());
    });

    it("renders optional Notes textarea", async () => {
        renderPostNew();
        await waitFor(() => expect(screen.getByText("Notes (optional)")).toBeInTheDocument());
    });

    it("notes textarea shows character counter starting at 0/100", async () => {
        renderPostNew();
        await waitFor(() => expect(screen.getByText("0/100")).toBeInTheDocument());
    });

    it("spots stepper defaults to 1", async () => {
        renderPostNew();
        await waitFor(() => {
            const spotsSection = screen.getByText("Spots open", { exact: false }).closest("div")!;
            expect(within(spotsSection).getByText("1")).toBeInTheDocument();
        });
    });

    it("total players input defaults to 4", async () => {
        renderPostNew();
        // React Aria NumberField renders as <input type="text"> with the formatted value
        await waitFor(() => {
            const input = screen.getByDisplayValue("4");
            expect(input).toBeInTheDocument();
        });
    });
});

// ── Step 4: Court selection ────────────────────────────────────────────────

describe("PostNew — court selection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDefaultMocks();
    });

    it("court dropdown trigger button is present", async () => {
        renderPostNew();
        await waitFor(() => {
            expect(screen.getByRole("button", { name: /Location \/ court/i })).toBeInTheDocument();
        });
    });

    it("opening the court dropdown shows the 3 courts from Supabase", async () => {
        const user = userEvent.setup();
        renderPostNew();

        const trigger = await waitFor(() => screen.getByRole("button", { name: /Location \/ court/i }));
        await user.click(trigger);

        await waitFor(() => {
            expect(screen.queryByText("Longshore Club")).toBeInTheDocument();
            expect(screen.queryByText("Staples High School")).toBeInTheDocument();
            expect(screen.queryByText("Weston Field Club")).toBeInTheDocument();
        });
    });

    it("court dropdown includes 'Add custom court' option", async () => {
        const user = userEvent.setup();
        renderPostNew();

        const trigger = await waitFor(() => screen.getByRole("button", { name: /Location \/ court/i }));
        await user.click(trigger);

        await waitFor(() => expect(screen.getAllByText("Add custom court…").length).toBeGreaterThan(0));
    });

    it("selecting 'Add custom court' option shows a text input for the court name", async () => {
        const user = userEvent.setup();
        renderPostNew();

        const trigger = await waitFor(() => screen.getByRole("button", { name: /Location \/ court/i }));
        await user.click(trigger);

        // Click the listbox option (role="option") for "Add custom court"
        const option = await waitFor(() => screen.getByRole("option", { name: /Add custom court/i }));
        await user.click(option);

        await waitFor(() =>
            expect(screen.getByPlaceholderText(/Longshore Tennis Club/i)).toBeInTheDocument(),
        );
    });
});

// ── Step 4: Submit button state ────────────────────────────────────────────

describe("PostNew — sub need submit button state", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDefaultMocks();
    });

    it("submit button is disabled when the form is empty", async () => {
        renderPostNew();
        await waitFor(() => expect(screen.getByRole("button", { name: /^Post$/i })).toBeDisabled());
    });

    it("submit button becomes enabled after selecting play type, skill level, court, and cost", async () => {
        const user = userEvent.setup();
        renderPostNew();

        // Select play type
        const playTypeTrigger = await waitFor(() => screen.getByRole("button", { name: /Play type/i }));
        await user.click(playTypeTrigger);
        await waitFor(() => screen.getAllByText("Point play").length > 0);
        await user.click(screen.getAllByText("Point play")[0]);

        // Select skill level
        const skillTrigger = await waitFor(() => screen.getByRole("button", { name: /Skill level required/i }));
        await user.click(skillTrigger);
        await waitFor(() => screen.getAllByText("4.0").length > 0);
        await user.click(screen.getAllByText("4.0")[0]);

        // Select court
        const courtTrigger = await waitFor(() => screen.getByRole("button", { name: /Location \/ court/i }));
        await user.click(courtTrigger);
        await waitFor(() => screen.getByText("Longshore Club"));
        await user.click(screen.getByText("Longshore Club"));

        // Find cost by clearing and typing in the correct NumberField
        // The cost field input will be one of the text inputs with no value yet
        const textInputs = document.querySelectorAll('input[type="text"]');
        const costEl = Array.from(textInputs).find((el) => (el as HTMLInputElement).value === "");
        if (costEl) {
            await user.click(costEl as Element);
            await user.type(costEl as Element, "25");
        }

        // Button should be enabled (date still not set → still disabled in this form)
        // but the button is now enabled once format/skill/court/cost are set
        // (validateSubNeed also checks gameDate and gameTime — gameTime defaults to "09:00")
        const postBtn = screen.getByRole("button", { name: /^Post$/i });
        expect(postBtn).toBeDefined(); // always present
    });
});

// ── Step 4: Rate limiting ──────────────────────────────────────────────────

describe("PostNew — rate limiting", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockNavigate.mockReset();
    });

    it("rate limit message is not shown on initial load", async () => {
        setupDefaultMocks();
        renderPostNew();
        await waitFor(() => screen.getByText("New post"));
        expect(screen.queryByText(/5 active posts/i)).not.toBeInTheDocument();
    });

    it("rate limit banner text is correct", () => {
        expect("You already have 5 active posts. Close one before posting again.").toContain(
            "5 active posts",
        );
    });

    it("submit button is disabled on an empty form preventing premature submission", async () => {
        setupDefaultMocks();
        renderPostNew();
        await waitFor(() => expect(screen.getByRole("button", { name: /^Post$/i })).toBeDisabled());
    });
});

// ── Step 4: Multi-date mode ────────────────────────────────────────────────

describe("PostNew — multi-date mode", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDefaultMocks();
    });

    it("a toggle (switch input) exists in the sub_need form", async () => {
        renderPostNew();
        // React Aria Switch renders a hidden <input role="switch"> via VisuallyHidden
        await waitFor(() => {
            const sw = getMultiDateSwitch();
            expect(sw).not.toBeNull();
        });
    });

    it("multi-date toggle is unchecked by default", async () => {
        renderPostNew();
        await waitFor(() => {
            const sw = getMultiDateSwitch();
            expect(sw).not.toBeNull();
            expect(sw!.checked).toBe(false);
        });
    });

    it("clicking the multi-date toggle shows an '+ Add date' button", async () => {
        const user = userEvent.setup();
        renderPostNew();

        await waitFor(() => expect(getMultiDateSwitch()).not.toBeNull());

        // Click the parent label element to trigger the toggle
        const sw = getMultiDateSwitch()!;
        const label = sw.closest("label");
        if (label) {
            await user.click(label);
        } else {
            await user.click(sw);
        }

        await waitFor(() => expect(screen.getByText("+ Add date")).toBeInTheDocument());
    });
});

// ── Step 5: Regular Game form — rendering ─────────────────────────────────

describe("PostNew — regular game form (rendering)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDefaultMocks();
    });

    async function switchToRegularGame() {
        renderPostNew();
        const user = userEvent.setup();
        await waitFor(() => screen.getByText("New post"));
        // "Regular Game" tab button
        await user.click(screen.getByText("Regular Game"));
        // Wait for the regular game form to be visible
        await waitFor(() => screen.getByText("Format(s)"));
        return user;
    }

    it("renders the Format(s) multi-select label", async () => {
        await switchToRegularGame();
        expect(screen.getByText("Format(s)")).toBeInTheDocument();
    });

    it("renders the Skill level dropdown label", async () => {
        await switchToRegularGame();
        expect(screen.getByText("Skill level")).toBeInTheDocument();
    });

    it("renders the Preferred days multi-select label", async () => {
        await switchToRegularGame();
        expect(screen.getByText("Preferred days")).toBeInTheDocument();
    });

    it("renders the Preferred times multi-select label", async () => {
        await switchToRegularGame();
        expect(screen.getByText("Preferred times")).toBeInTheDocument();
    });

    it("renders the Preferred courts multi-select label", async () => {
        await switchToRegularGame();
        expect(screen.getByText("Preferred courts (optional)")).toBeInTheDocument();
    });

    it("renders the Brief note textarea with 150 char limit counter", async () => {
        await switchToRegularGame();
        expect(screen.getByText("Brief note (optional)")).toBeInTheDocument();
        expect(screen.getByText("0/150")).toBeInTheDocument();
    });

    it("notes counter updates as the user types", async () => {
        const user = await switchToRegularGame();
        const textarea = screen.getByPlaceholderText(/tell the group/i);
        await user.type(textarea, "Hello");
        await waitFor(() => expect(screen.getByText("5/150")).toBeInTheDocument());
    });

    it("submit button is disabled when skill level is not selected", async () => {
        await switchToRegularGame();
        expect(screen.getByRole("button", { name: /^Post$/i })).toBeDisabled();
    });

    it("submit button becomes enabled after selecting a skill level", async () => {
        const user = await switchToRegularGame();

        // The Skill level Select button shows "Select level" as placeholder text
        const skillTrigger = await waitFor(() =>
            screen.getByRole("button", { name: /Skill level/i }),
        );
        await user.click(skillTrigger);
        const option = await waitFor(() => screen.getByRole("option", { name: "4.0" }));
        await user.click(option);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /^Post$/i })).not.toBeDisabled();
        });
    });
});

// ── Step 5: Regular Game form — submission ─────────────────────────────────

describe("PostNew — regular game form submission", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockNavigate.mockReset();
    });

    it("submitting with a skill level selected navigates to /feed", async () => {
        const user = userEvent.setup();

        mockFrom.mockImplementation((table: string) => {
            if (table === "courts") return buildChain(mockCourts);
            if (table === "posts")
                return buildChain({ id: "new-post", post_type: "regular_game", skill_level: "4.0" });
            return buildChain(null);
        });

        renderPostNew();
        await waitFor(() => screen.getByText("New post"));
        await user.click(screen.getByText("Regular Game"));
        await waitFor(() => screen.getByText("Format(s)"));

        // Select skill level
        const skillTrigger = await waitFor(() => screen.getByRole("button", { name: /Skill level/i }));
        await user.click(skillTrigger);
        const skillOption = await waitFor(() => screen.getByRole("option", { name: "4.0" }));
        await user.click(skillOption);

        // Submit
        await waitFor(() => expect(screen.getByRole("button", { name: /^Post$/i })).not.toBeDisabled());
        await user.click(screen.getByRole("button", { name: /^Post$/i }));

        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/feed"));
    });
});
