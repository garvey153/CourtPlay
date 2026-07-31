import { afterEach, describe, expect, it, vi } from "vitest";
import { describeActionError, describeAuthError, describeLoadError, isConnectivityError } from "@/utils/load-error";

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
        expect(title).toBe("Rain delay");
        expect(message).toContain("the feed");
        expect(message).toMatch(/without a connection/i);
    });

    it("falls back to a generic failure otherwise", () => {
        setOnline(true);
        const { title, message } = describeLoadError({ message: "boom", code: "42501" }, "reports");
        expect(title).toBe("That one went long");
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

describe("describeActionError", () => {
    it("blames the connection when offline", () => {
        setOnline(false);
        expect(describeActionError(new Error("whatever"), "save those changes")).toBe(
            "Rain delay — reconnect and try again.",
        );
    });

    it("names the action otherwise, without the underlying message", () => {
        setOnline(true);
        const copy = describeActionError({ message: 'duplicate key value violates constraint "courts_pkey"' }, "add that court");
        expect(copy).toBe("Couldn't add that court. Take another swing.");
        expect(copy).not.toContain("courts_pkey");
    });
});

describe("describeAuthError", () => {
    it("rewrites the auth failures people actually hit", () => {
        setOnline(true);
        expect(describeAuthError({ message: "Invalid login credentials" })).toBe(
            "That one's out. Check your email and password, then try again.",
        );
        expect(describeAuthError({ message: "Email not confirmed" })).toMatch(/confirmation link/i);
        expect(describeAuthError({ message: "User already registered" })).toMatch(/already on the roster/i);
        expect(describeAuthError({ message: "For security purposes, you can only request this after 45 seconds" })).toMatch(
            /take a breather/i,
        );
    });

    it("does not surface internal auth errors verbatim", () => {
        setOnline(true);
        const copy = describeAuthError({ message: "Database error granting user" });
        expect(copy).toBe("Something went wide. Give it another go.");
        expect(copy).not.toContain("Database");
    });

    it("still prefers the connection message when offline", () => {
        setOnline(false);
        expect(describeAuthError({ message: "Invalid login credentials" })).toMatch(/rain delay/i);
    });
});
