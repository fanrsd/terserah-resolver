export const ADMIN_COOKIE = "terserah_admin";
export const SESSION_SECONDS = 60 * 60 * 12;

/**
 * Env is read inside functions, never at module scope. `middleware.ts` imports
 * this module and runs early on Cloudflare Workers, where `process.env` is
 * populated per request — a module-scope read would capture undefined and lock
 * the panel shut on every deploy.
 */
const secret = () => process.env.ADMIN_PASSWORD;

/** Without a password the admin area refuses to open at all, never opens wide. */
export function hasAdmin(): boolean {
  return Boolean(secret());
}

const encoder = new TextEncoder();

// Web Crypto, not node:crypto: this module also runs in the edge middleware.
async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret() ?? ""),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );
  return [...new Uint8Array(signature)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Compares digests, not the passwords, so length never leaks. */
export async function checkPassword(input: unknown): Promise<boolean> {
  const expected = secret();
  if (!expected || typeof input !== "string") return false;

  const [givenDigest, expectedDigest] = await Promise.all([
    hmac(`pw:${input}`),
    hmac(`pw:${expected}`),
  ]);
  return constantTimeEqual(givenDigest, expectedDigest);
}

export async function issueToken(): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  return `${expiresAt}.${await hmac(`session:${expiresAt}`)}`;
}

/** A leaked cookie dies on its own; the expiry is inside the signed payload. */
export async function verifyToken(token: unknown): Promise<boolean> {
  if (!secret() || typeof token !== "string") return false;

  const separator = token.indexOf(".");
  if (separator < 1) return false;

  const expiresAt = Number(token.slice(0, separator));
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now() / 1000) {
    return false;
  }

  return constantTimeEqual(
    token.slice(separator + 1),
    await hmac(`session:${expiresAt}`),
  );
}
