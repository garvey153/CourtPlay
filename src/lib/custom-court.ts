import { supabase } from "@/lib/supabase";

/** Threshold at which the court is flagged for admin review. Mirrors the RPC's logic. */
export const ALERT_THRESHOLD = 3;

export interface CustomCourtRow {
    id: string;
    court_name: string;
    submission_count: number;
    alerted: boolean;
    area?: string | null;
    last_submitted_at?: string | null;
}

/**
 * Record a custom court submission.
 *
 * custom_court_submissions is admin-only under RLS, so regular users can't write it
 * directly. This calls the `record_custom_court_submission` SECURITY DEFINER RPC, which
 * upserts the row server-side (insert with count 1, or increment; flags for review at
 * ALERT_THRESHOLD) and records the poster's `area` so an admin can pre-fill it on approval.
 */
export async function upsertCustomCourt(name: string, area?: string | null): Promise<void> {
    const { error } = await supabase.rpc("record_custom_court_submission", {
        p_name: name,
        p_area: area?.trim() || null,
    });
    if (error) console.warn("Failed to record custom court submission:", error.message);
}
