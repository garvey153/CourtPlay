import { supabase } from "@/lib/supabase";

export interface InviteResult {
    ok: boolean;
    /** Ready to show. The server writes the copy for every failure it knows about. */
    message: string;
}

/**
 * Invite someone who isn't on CourtPlay yet.
 *
 * One caller for both places a player can do this — onboarding's "Invite a
 * player" step and the friends-search empty state — so they cannot drift on what
 * counts as success.
 *
 * The old onboarding code inserted the row itself and swallowed every failure:
 * the insert violated a foreign key (the profile does not exist yet at that
 * point in onboarding), the edge function it invoked had never been deployed,
 * and it showed "Invite sent" regardless. Both halves now happen server-side,
 * and this reports what actually occurred.
 *
 * `functions.invoke` RESOLVES on an HTTP error rather than rejecting, which is
 * how the original `.catch(() => {})` managed to hide a 404 — so the status has
 * to be read, not caught.
 */
export async function sendInvite(email: string): Promise<InviteResult> {
    const address = email.trim();
    if (!address) return { ok: false, message: "Enter an email address." };

    const { data, error } = await supabase.functions.invoke("send-invite", { body: { email: address } });

    if (error) {
        // FunctionsHttpError carries the response; the server's message is
        // better than anything we could write here.
        const body = await readErrorBody(error);
        return { ok: false, message: body ?? "Could not send that invite. Try again." };
    }
    if (data && typeof data === "object" && "error" in data) {
        return { ok: false, message: String((data as { error: unknown }).error) };
    }

    return { ok: true, message: `Invite sent to ${address}.` };
}

async function readErrorBody(error: unknown): Promise<string | null> {
    const context = (error as { context?: unknown }).context;
    if (!context || typeof (context as Response).json !== "function") return null;
    try {
        const body = await (context as Response).json();
        return typeof body?.error === "string" ? body.error : null;
    } catch {
        return null;
    }
}
