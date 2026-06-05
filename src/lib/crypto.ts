const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12;

async function getKey(): Promise<CryptoKey> {
    const rawKey = (import.meta.env.VITE_CRYPTO_KEY ?? "courtsub-default-key-for-dev!!").padEnd(32, "0").slice(0, 32);
    const keyData = new TextEncoder().encode(rawKey);
    return crypto.subtle.importKey("raw", keyData, ALGORITHM, false, ["encrypt", "decrypt"]);
}

export async function encrypt(plaintext: string): Promise<string> {
    const key = await getKey();
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, encoded);
    const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), IV_LENGTH);
    return btoa(String.fromCharCode(...combined));
}

export async function decrypt(ciphertext: string): Promise<string> {
    const key = await getKey();
    let data: Uint8Array;
    try {
        data = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
    } catch {
        throw new Error("Invalid ciphertext: not valid base64");
    }
    if (data.byteLength < IV_LENGTH) {
        throw new Error("Invalid ciphertext: too short");
    }
    const iv = data.slice(0, IV_LENGTH);
    const encrypted = data.slice(IV_LENGTH);
    try {
        const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, encrypted);
        return new TextDecoder().decode(decrypted);
    } catch {
        throw new Error("Decryption failed: invalid ciphertext or key");
    }
}
