import { describe, expect, it, vi, beforeEach } from "vitest";
import { sendInvite } from "@/lib/invite";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { functions: { invoke } } }));

/**
 * The onboarding invite reported success on two different failures for months:
 * the row it wrote violated a foreign key, and the function it invoked had never
 * been deployed. `functions.invoke` RESOLVES on an HTTP error rather than
 * rejecting, so the `.catch(() => {})` around it was a no-op and a 404 looked
 * exactly like a send.
 *
 * These pin the thing that was actually broken: a failure must reach the caller.
 */
describe("sendInvite", () => {
    beforeEach(() => invoke.mockReset());

    it("reports success when the server sent it", async () => {
        invoke.mockResolvedValue({ data: { success: true, email: "a@b.com" }, error: null });
        expect(await sendInvite("a@b.com")).toEqual({ ok: true, message: "Invite sent to a@b.com." });
    });

    it("surfaces the server's message on an HTTP error", async () => {
        invoke.mockResolvedValue({
            data: null,
            error: { context: { json: async () => ({ error: "They're already on CourtPlay — search for them instead." }) } },
        });
        const result = await sendInvite("member@example.com");
        expect(result.ok).toBe(false);
        expect(result.message).toBe("They're already on CourtPlay — search for them instead.");
    });

    /** A missing function resolves with an error rather than throwing. */
    it("does NOT report success when the function is missing", async () => {
        invoke.mockResolvedValue({ data: null, error: { context: { json: async () => ({}) } } });
        const result = await sendInvite("a@b.com");
        expect(result.ok).toBe(false);
        expect(result.message).toBe("Could not send that invite. Try again.");
    });

    it("treats an error body in a 200 as a failure too", async () => {
        invoke.mockResolvedValue({ data: { error: "That's 20 invites today — try again tomorrow." }, error: null });
        const result = await sendInvite("a@b.com");
        expect(result.ok).toBe(false);
        expect(result.message).toContain("20 invites today");
    });

    it("refuses an empty address without calling the server", async () => {
        expect(await sendInvite("   ")).toEqual({ ok: false, message: "Enter an email address." });
        expect(invoke).not.toHaveBeenCalled();
    });
});
