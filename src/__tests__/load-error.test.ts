import { afterEach, describe, expect, it, vi } from "vitest";
import { describeLoadError, isConnectivityError } from "@/utils/load-error";

function setOnline(value: boolean) {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(value);
}

afterEach(() => vi.restoreAllMocks());

describe("isConnectivityError", () => {
    it("is true whenever the device reports itself offline", () => {
        setOnline(false);
        // Even a failure that looks unrelated is a connectivity failure offline.
        expect(isConnectivityError(new Error("permission denied"))).toBe(true);
    });

    it("recognises the transport failures each browser produces", () => {
        setOnline(true);
        expect(isConnectivityError(new TypeError("Load failed"))).toBe(true); // Safari
        expect(isConnectivityError(new TypeError("Failed to fetch"))).toBe(true); // Chrome
        expect(isConnectivityError({ message: "NetworkError when attempting to fetch resource." })).toBe(true);
    });

    it("leaves genuine server errors alone", () => {
        setOnline(true);
        expect(isConnectivityError({ message: "permission denied for table users", code: "42501" })).toBe(false);
        expect(isConnectivityError(null)).toBe(false);
    });
});

describe("describeLoadError", () => {
    it("names the connection as the problem when offline", () => {
        setOnline(false);
        const { title, message } = describeLoadError(new TypeError("Load failed"), "the feed");
        expect(title).toBe("No internet connection");
        expect(message).toContain("the feed");
        expect(message).toMatch(/offline/i);
    });

    it("falls back to a generic failure otherwise", () => {
        setOnline(true);
        const { title, message } = describeLoadError({ message: "boom", code: "42501" }, "reports");
        expect(title).toBe("Something went wrong");
        expect(message).toContain("reports");
    });

    it("never leaks the underlying message or code", () => {
        setOnline(true);
        const raw = "TypeError: Load failed";
        const { title, message } = describeLoadError(new Error("permission denied for table users (42501)"), "posts");
        expect(`${title} ${message}`).not.toContain("42501");
        expect(`${title} ${message}`).not.toContain("permission denied");
        expect(`${title} ${message}`).not.toContain(raw);
    });
});
