import { DEFAULT_PERSONA, type Settings } from "./settings-schema.ts";
import { supabase } from "./supabase.ts";

export const DEFAULTS: Settings = {
  model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  temperature: 1.1,
  persona: DEFAULT_PERSONA,
  placeCheck: true,
  paused: false,
};

const CACHE_MS = 30_000;

// Settings are read on every verdict but changed a few times a year. A short
// TTL keeps the hot path off the network without stranding an admin edit.
const cache = globalThis as unknown as {
  __terserahSettings?: { value: Settings; readAt: number };
};

export function invalidateSettings(): void {
  cache.__terserahSettings = undefined;
}

export async function getSettings(): Promise<Settings> {
  const hit = cache.__terserahSettings;
  if (hit && Date.now() - hit.readAt < CACHE_MS) return hit.value;
  if (!supabase) return DEFAULTS;

  const { data, error } = await supabase
    .from("settings")
    .select("model, temperature, persona, place_check, paused")
    .eq("id", true)
    .maybeSingle();

  if (error || !data) return DEFAULTS;

  const value: Settings = {
    model: data.model || DEFAULTS.model,
    temperature:
      typeof data.temperature === "number"
        ? data.temperature
        : DEFAULTS.temperature,
    persona: data.persona?.trim() || DEFAULT_PERSONA,
    placeCheck: data.place_check ?? true,
    paused: data.paused ?? false,
  };

  cache.__terserahSettings = { value, readAt: Date.now() };
  return value;
}

export async function saveSettings(next: Settings): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase.from("settings").upsert({
    id: true,
    model: next.model,
    temperature: next.temperature,
    persona: next.persona,
    place_check: next.placeCheck,
    paused: next.paused,
    updated_at: new Date().toISOString(),
  });

  if (error) return false;
  invalidateSettings();
  return true;
}
