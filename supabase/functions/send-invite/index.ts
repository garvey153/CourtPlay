import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, corsJson, handlePreflight } from "../_shared/cors.ts";
import { invokeFunction } from "../_shared/invoke.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://www.courtplay.app";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/** Bump on every deploy — see the same constant in send-notification for why. */
const FN_BUILD = "2026-08-16a";

/** Per-inviter daily cap. */
const DAILY_LIMIT = 20;

/**
 * Invite someone to the closed beta.
 *
 * The client has called this name since long before the function existed — the
 * old onboarding code invoked `send-invite` and swallowed the 404, so it showed
 * "Invite sent" while nothing was sent and the row it wrote failed a foreign key.
 * Both halves are fixed here: the row is written server-side with the service
 * role, and a failure is reported rather than hidden.
 *
 * THE INVITER COMES FROM THE JWT, never from the body. The old client sent
 * `inviter_id` in the payload, which is exactly the pattern notification-authz
 * was written to kill: anyone holding the anon key could then attribute invites
 * to someone else.
 *
 * This is the first path in the app that mails an arbitrary, caller-supplied
 * address from a domain-verified sender, so it is rate limited per inviter.
 */
serve(async (req) => {
    const preflight = handlePreflight(req);
    if (preflight) return preflight;

    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return corsJson({ error: "Unauthorized", fnBuild: FN_BUILD }, 401);

    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    const inviter = auth?.user;
    if (authError || !inviter) return corsJson({ error: "Unauthorized", fnBuild: FN_BUILD }, 401);

    // An unparseable body would throw out of the handler, and the platform's 500
    // carries no CORS headers — the browser reports a generic network failure
    // instead of the actual complaint.
    let email: unknown;
    try {
        ({ email } = await req.json());
    } catch {
        return corsJson({ error: "Body must be JSON", fnBuild: FN_BUILD }, 400);
    }

    const address = typeof email === "string" ? email.trim().toLowerCase() : "";
    // Deliberately loose: a typo catcher, not an RFC 5322 parser. The address
    // either receives the invite or it does not.
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
        return corsJson({ error: "That doesn't look like an email address.", fnBuild: FN_BUILD }, 400);
    }

    // Already a member? Say so plainly rather than mailing them an invite to
    // something they are already in.
    const { data: existing } = await supabase.from("users").select("id").ilike("email", address).maybeSingle();
    if (existing) {
        return corsJson({ error: "They're already on CourtPlay — search for them instead.", fnBuild: FN_BUILD }, 409);
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
        .from("invites")
        .select("id", { count: "exact", head: true })
        .eq("inviter_id", inviter.id)
        .gte("sent_at", since);
    if ((count ?? 0) >= DAILY_LIMIT) {
        return corsJson({ error: `That's ${DAILY_LIMIT} invites today — try again tomorrow.`, fnBuild: FN_BUILD }, 429);
    }

    // The inviter's display name, for the copy. Falls back to a generic line
    // rather than failing the invite over a missing profile.
    const { data: profile } = await supabase
        .from("users")
        .select("first_name, last_name")
        .eq("id", inviter.id)
        .maybeSingle();
    const inviterName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();

    // Idempotent: re-inviting the same address from the same account updates the
    // timestamp rather than erroring, so "resend" is the same call as "send".
    const { error: insertError } = await supabase
        .from("invites")
        .upsert(
            { inviter_id: inviter.id, email: address, source: "member", sent_at: new Date().toISOString() },
            { onConflict: "inviter_id,email" },
        );
    if (insertError) {
        console.error("send-invite: could not record the invite", insertError);
        return corsJson({ error: "Could not record that invite.", fnBuild: FN_BUILD }, 500);
    }

    const link = `${APP_URL}/signup?email=${encodeURIComponent(address)}`;
    const html = buildInviteHtml(inviterName, link, address);
    const sent = await invokeFunction("send-email", {
        to: address,
        subject: inviterName ? `${inviterName} invited you to CourtPlay` : "You're invited to CourtPlay",
        html,
    });

    if (!sent.ok) {
        console.error("send-invite: send-email failed", sent.status, sent.body);
        // The row is kept: the invite is real and the address can now sign up,
        // which matters more than the mail. Say so rather than claiming success.
        return corsJson(
            { error: "They're on the list, but the email didn't send. Tell them directly.", fnBuild: FN_BUILD },
            502,
        );
    }

    return corsJson({ success: true, email: address, fnBuild: FN_BUILD }, 200);
});

/**
 * Matches send-notification's email styling — same 480px column, same brand
 * green, same muted footer. Copied rather than shared because extracting that
 * template means touching the most critical function in the system; see the
 * note in the plan.
 */
function buildInviteHtml(inviterName: string, link: string, address: string): string {
    const who = inviterName ? `${escapeHtml(inviterName)} invited you` : "You've been invited";
    return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #1B1B1B; font-size: 18px; margin: 0 0 8px;">${who} to CourtPlay</h2>
  <p style="color: #6B7280; font-size: 14px; line-height: 1.5; margin: 0 0 16px;">
    CourtPlay helps tennis players fill an open spot in a game. Post a spot when someone
    drops out, or claim one when you want to play.
  </p>
  <p style="color: #6B7280; font-size: 14px; line-height: 1.5; margin: 0 0 16px;">
    We're in a closed beta, so this invite is tied to
    <strong style="color: #1B1B1B;">${escapeHtml(address)}</strong> — sign up with that address.
  </p>
  <a href="${link}" style="display: inline-block; padding: 10px 20px; background: #2D6A4F; color: white; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
    Create your account
  </a>
  <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0 12px;" />
  <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
    CourtPlay — fill an open spot in a tennis game<br />
    You received this because someone invited you. No account is created until you sign up.
  </p>
</div>`.trim();
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
