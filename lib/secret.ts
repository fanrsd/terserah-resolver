/**
 * AES-GCM for the one secret that has to live in the database: the API key for
 * a custom endpoint the admin points at without a redeploy.
 *
 * The master key stays in env, so a Supabase snapshot alone is not enough to
 * read it. Without `SETTINGS_ENCRYPTION_KEY` the admin UI disables the field
 * rather than storing anything in the clear.
 *
 * Env is read inside functions, never at module scope: on Cloudflare Workers
 * `process.env` is populated per request, so a module-scope read captures
 * undefined at isolate start.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function canStoreSecrets(): boolean {
  const master = process.env.SETTINGS_ENCRYPTION_KEY;
  return Boolean(master && master.length >= 16);
}

async function masterKey(): Promise<CryptoKey> {
  // SHA-256 of the passphrase gives AES-GCM the 32 bytes it wants from an env
  // string of any length. Not a KDF: this guards a stored value, not a password.
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(process.env.SETTINGS_ENCRYPTION_KEY ?? ""),
  );
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Returns base64 of `iv || ciphertext`, or null when encryption is unavailable. */
export async function encryptSecret(plain: string): Promise<string | null> {
  if (!canStoreSecrets() || !plain) return null;

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await masterKey(),
    encoder.encode(plain),
  );

  const packed = new Uint8Array(iv.length + ciphertext.byteLength);
  packed.set(iv);
  packed.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...packed));
}

/** Null on a rotated master key or a tampered blob — never throws at the caller. */
export async function decryptSecret(packed: unknown): Promise<string | null> {
  if (!canStoreSecrets() || typeof packed !== "string" || !packed) return null;

  try {
    const bytes = Uint8Array.from(atob(packed), (c) => c.charCodeAt(0));
    if (bytes.length <= 12) return null;

    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.subarray(0, 12) },
      await masterKey(),
      bytes.subarray(12),
    );
    return decoder.decode(plain);
  } catch {
    return null;
  }
}
