import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "./crypto";

describe("crypto", () => {
    it("encrypts and decrypts a phone number round-trip", async () => {
        const plaintext = "203-555-1234";
        const ciphertext = await encrypt(plaintext);
        const result = await decrypt(ciphertext);
        expect(result).toBe(plaintext);
    });

    it("encrypts and decrypts a Venmo handle round-trip", async () => {
        const plaintext = "@jane-doe";
        const ciphertext = await encrypt(plaintext);
        const result = await decrypt(ciphertext);
        expect(result).toBe(plaintext);
    });

    it("encrypted output is different from the plaintext input", async () => {
        const plaintext = "203-555-1234";
        const ciphertext = await encrypt(plaintext);
        expect(ciphertext).not.toBe(plaintext);
    });

    it("two different inputs produce different ciphertext", async () => {
        const cipher1 = await encrypt("203-555-1234");
        const cipher2 = await encrypt("@jane-doe");
        expect(cipher1).not.toBe(cipher2);
    });

    it("decrypting garbage input throws an error", async () => {
        await expect(decrypt("not-valid-ciphertext!!")).rejects.toThrow();
    });
});
