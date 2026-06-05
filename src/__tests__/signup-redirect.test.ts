import { describe, expect, it } from "vitest";
import { validateRedirect } from "@/utils/validate-redirect";

describe("signup redirect validation", () => {
    it("allows valid /post/:uuid paths", () => {
        const result = validateRedirect("/post/aaaaaaaa-0000-0000-0000-000000000001");
        expect(result).toBe("/post/aaaaaaaa-0000-0000-0000-000000000001");
    });

    it("defaults to null when no redirect param", () => {
        expect(validateRedirect(null)).toBeNull();
        expect(validateRedirect("")).toBeNull();
    });

    it("rejects external URLs", () => {
        expect(validateRedirect("https://evil.com")).toBeNull();
    });

    it("rejects non-post paths", () => {
        expect(validateRedirect("/admin")).toBeNull();
        expect(validateRedirect("/feed")).toBeNull();
        expect(validateRedirect("/profile/me")).toBeNull();
    });

    it("rejects javascript: URI", () => {
        expect(validateRedirect("javascript:alert(1)")).toBeNull();
    });

    it("rejects /post/ with non-UUID ID", () => {
        expect(validateRedirect("/post/not-a-uuid")).toBeNull();
    });

    it("rejects /post/ with path traversal", () => {
        expect(validateRedirect("/post/../../admin")).toBeNull();
    });

    it("accepts uppercase UUID", () => {
        const result = validateRedirect("/post/AAAAAAAA-0000-0000-0000-000000000001");
        expect(result).toBe("/post/AAAAAAAA-0000-0000-0000-000000000001");
    });
});
