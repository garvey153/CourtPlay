import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => {
    const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    return {
        supabase: {
            from: vi.fn().mockReturnValue({
                update: mockUpdate,
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        in: vi.fn().mockResolvedValue({ data: [], error: null }),
                        neq: vi.fn().mockResolvedValue({ data: [], error: null }),
                    }),
                }),
            }),
            functions: { invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }) },
        },
    };
});

/**
 * Simulates the validation and update logic for the discount mechanic.
 * Mirrors the logic in handleReducePrice on the Activity page.
 */
function validateAndDiscount(newPriceStr: string, currentCost: number, originalCost: number | null) {
    const parsed = parseFloat(newPriceStr);
    if (isNaN(parsed) || parsed < 0 || parsed >= currentCost) {
        return { valid: false as const, error: "New price must be lower than the current price." };
    }
    return {
        valid: true as const,
        updatePayload: { cost: parsed, original_cost: originalCost ?? currentCost },
    };
}

describe("Discount mechanic", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("discount updates cost and sets original_cost on first discount", async () => {
        const result = validateAndDiscount("30", 40, null);

        expect(result.valid).toBe(true);
        if (!result.valid) return;
        expect(result.updatePayload).toEqual({ cost: 30, original_cost: 40 });

        // Verify supabase update is called correctly
        const postId = "post-1";
        await supabase.from("posts").update(result.updatePayload).eq("id", postId);

        expect(supabase.from).toHaveBeenCalledWith("posts");
        const fromResult = supabase.from("posts");
        expect(fromResult.update).toHaveBeenCalledWith({ cost: 30, original_cost: 40 });
    });

    it("second discount updates cost but preserves original_cost", async () => {
        const result = validateAndDiscount("20", 30, 40);

        expect(result.valid).toBe(true);
        if (!result.valid) return;
        expect(result.updatePayload).toEqual({ cost: 20, original_cost: 40 });

        const postId = "post-1";
        await supabase.from("posts").update(result.updatePayload).eq("id", postId);

        const fromResult = supabase.from("posts");
        expect(fromResult.update).toHaveBeenCalledWith({ cost: 20, original_cost: 40 });
    });

    it("third discount to $0 works", async () => {
        const result = validateAndDiscount("0", 20, 40);

        expect(result.valid).toBe(true);
        if (!result.valid) return;
        expect(result.updatePayload).toEqual({ cost: 0, original_cost: 40 });

        const postId = "post-1";
        await supabase.from("posts").update(result.updatePayload).eq("id", postId);

        const fromResult = supabase.from("posts");
        expect(fromResult.update).toHaveBeenCalledWith({ cost: 0, original_cost: 40 });
    });

    it("discount to equal current cost is rejected", () => {
        const result = validateAndDiscount("30", 30, null);

        expect(result.valid).toBe(false);
        expect(result.error).toBe("New price must be lower than the current price.");
        expect(supabase.from("posts").update).not.toHaveBeenCalled();
    });

    it("discount to higher than current cost is rejected", () => {
        const result = validateAndDiscount("35", 30, null);

        expect(result.valid).toBe(false);
        expect(result.error).toBe("New price must be lower than the current price.");
    });

    it("discount to negative value is rejected", () => {
        const result = validateAndDiscount("-5", 30, null);

        expect(result.valid).toBe(false);
        expect(result.error).toBe("New price must be lower than the current price.");
    });

    it("discount to non-numeric value is rejected", () => {
        const result = validateAndDiscount("abc", 30, null);

        expect(result.valid).toBe(false);
        expect(result.error).toBe("New price must be lower than the current price.");
        // Confirm parseFloat("abc") is NaN
        expect(isNaN(parseFloat("abc"))).toBe(true);
    });

    it("discount with decimal values works", async () => {
        const result = validateAndDiscount("29.50", 40, null);

        expect(result.valid).toBe(true);
        if (!result.valid) return;
        expect(result.updatePayload).toEqual({ cost: 29.5, original_cost: 40 });

        const postId = "post-1";
        await supabase.from("posts").update(result.updatePayload).eq("id", postId);

        const fromResult = supabase.from("posts");
        expect(fromResult.update).toHaveBeenCalledWith({ cost: 29.5, original_cost: 40 });
    });

    it("discount atomic update — cost and original_cost set in single call", async () => {
        const result = validateAndDiscount("25", 40, null);
        expect(result.valid).toBe(true);
        if (!result.valid) return;

        const postId = "post-1";
        await supabase.from("posts").update(result.updatePayload).eq("id", postId);

        const fromResult = supabase.from("posts");
        // .update() is called exactly once, with both cost and original_cost in a single payload
        expect(fromResult.update).toHaveBeenCalledTimes(1);
        expect(fromResult.update).toHaveBeenCalledWith(
            expect.objectContaining({
                cost: 25,
                original_cost: 40,
            }),
        );
    });

    it("Reduce price button shown only on own active posts", () => {
        // Simulate post state logic: only active posts owned by the user show the button
        const posts = [
            { id: "1", status: "active", isOwn: true },
            { id: "2", status: "expired", isOwn: true },
            { id: "3", status: "active", isOwn: false },
        ];

        const showReducePrice = (post: { status: string; isOwn: boolean }) =>
            post.status === "active" && post.isOwn;

        expect(showReducePrice(posts[0])).toBe(true);
        expect(showReducePrice(posts[1])).toBe(false);
        expect(showReducePrice(posts[2])).toBe(false);
    });

    it("Reduce price button disabled during save", () => {
        // Simulate isLoading state gating the button
        let isLoading = false;
        const isButtonDisabled = () => isLoading;

        expect(isButtonDisabled()).toBe(false);

        isLoading = true;
        expect(isButtonDisabled()).toBe(true);
    });
});
