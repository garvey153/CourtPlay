import { supabase } from "@/lib/supabase";

/** Threshold at which the court is flagged for admin review. */
export const ALERT_THRESHOLD = 3;

export interface CustomCourtRow {
    id: string;
    court_name: string;
    submission_count: number;
    alerted: boolean;
    last_submitted_at?: string | null;
}

/**
 * Upsert a custom court submission.
 * - If the court name is new: insert with submission_count = 1.
 * - If the court already exists: increment submission_count.
 * - When submission_count reaches ALERT_THRESHOLD and alerted is false:
 *   set alerted = true (admin email wired in Phase 7).
 */
export async function upsertCustomCourt(name: string): Promise<void> {
    const { data: existing } = await supabase
        .from("custom_court_submissions")
        .select("id, submission_count, alerted")
        .eq("court_name", name)
        .maybeSingle();

    if (existing) {
        const newCount = (existing as CustomCourtRow).submission_count + 1;
        const shouldAlert =
            newCount >= ALERT_THRESHOLD && !(existing as CustomCourtRow).alerted;

        await supabase
            .from("custom_court_submissions")
            .update({
                submission_count: newCount,
                alerted: shouldAlert ? true : (existing as CustomCourtRow).alerted,
                last_submitted_at: new Date().toISOString(),
            })
            .eq("id", (existing as CustomCourtRow).id);
    } else {
        await supabase.from("custom_court_submissions").insert({
            court_name: name,
            submission_count: 1,
            alerted: false,
        });
    }
}
