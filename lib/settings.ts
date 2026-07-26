import { decryptSecret, encryptSecret } from "./secret.ts";
import { DEFAULT_PERSONA, type Settings } from "./settings-schema.ts";
import { supabase } from "./supabase.ts";

export const DEFAULTS: Settings = {
  provider: "gemini",
  baseUrl: "",
  model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  temperature: 1.1,
  persona: DEFAULT_PERSONA,
  placeCheck: true,
  paused: false,
};

/** Settings plus the bits the browser must never receive. */
type StoredSettings = Settings & {
  apiKeyCipher: string | null;
};

const CACHE_MS = 30_000;

// Settings are read on every verdict but changed a few times a year. A short
// TTL keeps the hot path off the network without stranding an admin edit.
const cache = globalThis as unknown as {
  __terserahSettings?: { value: StoredSettings; readAt: number };
};

export function invalidateSettings(): void {
  cache.__terserahSettings = undefined;
}

async function read(): Promise<StoredSettings> {
  const hit = cache.__terserahSettings;
  if (hit && Date.now() - hit.readAt < CACHE_MS) return hit.value;
  if (!supabase) return { ...DEFAULTS, apiKeyCipher: null };

  const { data, error } = await supabase
    .from("settings")
    .select(
      "provider, base_url, model, temperature, persona, place_check, paused, api_key_cipher",
    )
    .eq("id", true)
    .maybeSingle();

  if (error || !data) return { ...DEFAULTS, apiKeyCipher: null };

  const value: StoredSettings = {
    provider: data.provider === "openai" ? "openai" : "gemini",
    baseUrl: data.base_url ?? "",
    model: data.model || DEFAULTS.model,
    temperature:
      typeof data.temperature === "number"
        ? data.temperature
        : DEFAULTS.temperature,
    persona: data.persona?.trim() || DEFAULT_PERSONA,
    placeCheck: data.place_check ?? true,
    paused: data.paused ?? false,
    apiKeyCipher: data.api_key_cipher ?? null,
  };

  cache.__terserahSettings = { value, readAt: Date.now() };
  return value;
}

export async function getSettings(): Promise<Settings> {
  const { apiKeyCipher: _omit, ...settings } = await read();
  return settings;
}

/** Server-only. Never send the result anywhere near a response body. */
export async function getProviderKey(): Promise<string | null> {
  const { provider, apiKeyCipher } = await read();

  if (provider === "gemini") return process.env.GEMINI_API_KEY ?? null;

  return (
    (await decryptSecret(apiKeyCipher)) ??
    process.env.LLM_API_KEY ??
    process.env.OPENAI_API_KEY ??
    null
  );
}

export async function hasStoredKey(): Promise<boolean> {
  return Boolean((await read()).apiKeyCipher);
}

/**
 * `apiKey` is three-state on purpose: undefined keeps whatever is stored, a
 * string replaces it, and null clears it. A form that always sent a value
 * would wipe the key every time the admin edited the persona.
 */
export async function saveSettings(
  next: Settings,
  apiKey?: string | null,
): Promise<boolean> {
  if (!supabase) return false;

  const row: Record<string, unknown> = {
    id: true,
    provider: next.provider,
    base_url: next.baseUrl,
    model: next.model,
    temperature: next.temperature,
    persona: next.persona,
    place_check: next.placeCheck,
    paused: next.paused,
    updated_at: new Date().toISOString(),
  };

  if (apiKey === null) row.api_key_cipher = null;
  else if (typeof apiKey === "string" && apiKey) {
    const cipher = await encryptSecret(apiKey);
    if (!cipher) return false; // no master key: refuse rather than store plaintext
    row.api_key_cipher = cipher;
  }

  const { error } = await supabase.from("settings").upsert(row);
  if (error) return false;

  invalidateSettings();
  return true;
}
