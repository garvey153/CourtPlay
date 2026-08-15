/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Short commit SHA of the running build, injected at build time (see vite.config.ts). */
declare const __BUILD_ID__: string;

/**
 * Vite exposes only VITE_-prefixed vars to the client, and everything here ships
 * in the bundle. Declared so `import.meta.env.VITE_X` is a string rather than
 * `any` — a typo in the name was previously undetectable.
 */
interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    readonly VITE_CRYPTO_KEY: string;
    readonly VITE_ONESIGNAL_APP_ID: string;
    /** "true" runs the app as a closed beta — see src/lib/beta.ts. */
    readonly VITE_INVITE_ONLY?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
