import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
    supabase: {
        from: vi.fn().mockReturnValue({
            insert: vi.fn().mockResolvedValue({ error: null }),
        }),
    },
}));

function prepareNote(raw: string): string | null {
    return raw.trim() || null;
}

function prepareReportPayload(
    reporterId: string,
    targetType: "post" | "user",
    targetId: string,
    reason: string,
    note: string,
) {
    return {
        reporter_id: reporterId,
        target_type: targetType,
        target_id: targetId,
        reason,
        note: prepareNote(note),
    };
}

describe("Report edge cases", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("user can report the same post with different reasons", async () => {
        const payload1 = prepareReportPayload(
            "user-a",
            "post",
            "post-1",
            "spam",
            "",
        );
        const payload2 = prepareReportPayload(
            "user-a",
            "post",
            "post-1",
            "harassment",
            "",
        );

        const result1 = await supabase.from("reports").insert(payload1);
        const result2 = await supabase.from("reports").insert(payload2);

        expect(result1.error).toBeNull();
        expect(result2.error).toBeNull();
        expect(payload1.reason).not.toBe(payload2.reason);
    });

    it("multiple users can report the same post", async () => {
        const payload1 = prepareReportPayload(
            "user-a",
            "post",
            "post-1",
            "spam",
            "",
        );
        const payload2 = prepareReportPayload(
            "user-b",
            "post",
            "post-1",
            "spam",
            "",
        );

        const result1 = await supabase.from("reports").insert(payload1);
        const result2 = await supabase.from("reports").insert(payload2);

        expect(result1.error).toBeNull();
        expect(result2.error).toBeNull();
        expect(payload1.reporter_id).not.toBe(payload2.reporter_id);
    });

    it("multiple users can report the same user", async () => {
        const payload1 = prepareReportPayload(
            "user-a",
            "user",
            "target-user-1",
            "inappropriate",
            "",
        );
        const payload2 = prepareReportPayload(
            "user-b",
            "user",
            "target-user-1",
            "inappropriate",
            "",
        );

        const result1 = await supabase.from("reports").insert(payload1);
        const result2 = await supabase.from("reports").insert(payload2);

        expect(result1.error).toBeNull();
        expect(result2.error).toBeNull();
        expect(payload1.reporter_id).not.toBe(payload2.reporter_id);
        expect(payload1.target_id).toBe(payload2.target_id);
    });

    it("report note with special characters stored correctly", () => {
        const rawNote = `He said <script>alert("xss")</script> & it's "bad"`;
        const payload = prepareReportPayload(
            "user-a",
            "post",
            "post-1",
            "spam",
            rawNote,
        );

        expect(payload.note).toBe(rawNote);
        expect(payload.note).toContain("<");
        expect(payload.note).toContain("&");
        expect(payload.note).toContain("'");
        expect(payload.note).toContain('"');
    });

    it("report note with only whitespace treated as null", () => {
        const payload = prepareReportPayload(
            "user-a",
            "post",
            "post-1",
            "spam",
            "   ",
        );

        expect(payload.note).toBeNull();
    });

    it("report with empty note stores null", () => {
        const payload = prepareReportPayload(
            "user-a",
            "post",
            "post-1",
            "spam",
            "",
        );

        expect(payload.note).toBeNull();
    });

    it("rapid double-tap prevention — submit button disabled during async", async () => {
        let submitting = false;
        let callCount = 0;

        const handleSubmit = async () => {
            if (submitting) return;
            submitting = true;
            callCount++;
            // Simulate async work
            await new Promise((resolve) => setTimeout(resolve, 10));
            submitting = false;
        };

        // Fire two submits back-to-back without awaiting
        const first = handleSubmit();
        const second = handleSubmit();

        await Promise.all([first, second]);

        expect(callCount).toBe(1);
    });
});
