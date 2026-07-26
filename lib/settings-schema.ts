/**
 * Pure half of the settings module: no Supabase import, so the admin form can
 * use these without pulling the SDK into the client bundle.
 */

export const DEFAULT_PERSONA = `Kamu adalah hakim tunggal di "Pengadilan Terserah". Kamu memutus sengketa
"mau makan di mana" antara dua orang. Nada bicaramu: formal, dingin, sarkastis, seperti
membacakan putusan resmi. Humormu datang dari kontras antara bahasa birokrasi yang kaku
dan isi yang menohok.

ATURAN YANG TIDAK BISA DILANGGAR:
1. Sindir KEDUA belah pihak. Bukan cuma satu. Kalau kamu cuma menyindir Pihak B, putusan
   ini berubah jadi senjata Pihak A dan kamu gagal. Pihak A juga salah: dia sengaja
   memilih tempat yang menyebalkan supaya pasangannya bereaksi.
2. Sebutkan TEPAT SATU tempat makan yang benar-benar ada di kota yang disebutkan.
   Nama spesifik, bukan kategori. Jangan tawarkan alternatif.
3. Alasan maksimal 2 kalimat, di bawah 220 karakter. Bahasa Indonesia santai.
4. Jangan menggurui, jangan minta maaf, jangan menawarkan opsi lain.
5. Balas HANYA JSON: {"place": string, "maps_query": string, "reasoning": string}.`;

export type Provider = "gemini" | "openai";

export type Settings = {
  /** `openai` means any OpenAI-compatible /chat/completions endpoint. */
  provider: Provider;
  /** Base URL for `openai`, e.g. https://openrouter.ai/api/v1. Ignored for gemini. */
  baseUrl: string;
  model: string;
  temperature: number;
  /** The system prompt. The single highest-leverage knob in the product. */
  persona: string;
  /** Local Foursquare existence check. Off = trust the model outright. */
  placeCheck: boolean;
  /** Kill switch: stops new cases without a redeploy. */
  paused: boolean;
};

export const LIMITS = {
  personaMax: 6000,
  modelMax: 120,
  baseUrlMax: 300,
  apiKeyMax: 400,
  temperatureMin: 0,
  temperatureMax: 2,
};

/** Presets are a convenience only; any OpenAI-compatible URL is accepted. */
export const ENDPOINT_PRESETS = [
  { label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "google/gemini-2.5-flash",
  },
  {
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
  },
  {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
  },
  {
    label: "Gemini (OpenAI-compat)",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.5-flash",
  },
  { label: "Ollama lokal", baseUrl: "http://localhost:11434/v1", model: "llama3.1" },
] as const;

/**
 * Accepts `…/v1`, `…/v1/`, or `…/v1/chat/completions` and always returns the
 * full completions URL. Pasting the endpoint straight out of a provider's docs
 * is the common case and must not 404.
 */
export function completionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/chat/completions")
    ? trimmed
    : `${trimmed}/chat/completions`;
}

export function normalizeSettings(input: unknown): Settings | null {
  if (typeof input !== "object" || input === null) return null;
  const raw = input as Record<string, unknown>;

  const provider: Provider = raw.provider === "openai" ? "openai" : "gemini";

  const model = String(raw.model ?? "")
    .trim()
    .slice(0, LIMITS.modelMax);
  const baseUrl = String(raw.baseUrl ?? "")
    .trim()
    .slice(0, LIMITS.baseUrlMax);
  const temperature = Number(raw.temperature);
  const persona = String(raw.persona ?? "")
    .trim()
    .slice(0, LIMITS.personaMax);

  if (!model) return null;
  if (
    !Number.isFinite(temperature) ||
    temperature < LIMITS.temperatureMin ||
    temperature > LIMITS.temperatureMax
  ) {
    return null;
  }

  // A custom endpoint without a URL would silently fall through to the
  // fallback verdict on every case, so reject it at the boundary instead.
  if (provider === "openai") {
    if (!URL.canParse(baseUrl)) return null;
    const { protocol } = new URL(baseUrl);
    if (protocol !== "https:" && protocol !== "http:") return null;
  }

  return {
    provider,
    baseUrl,
    model,
    temperature,
    // A blank textarea means "use the shipped default", so the judge can never
    // be silently stripped of its instructions.
    persona: persona || DEFAULT_PERSONA,
    placeCheck: Boolean(raw.placeCheck),
    paused: Boolean(raw.paused),
  };
}

/**
 * Three-state and mirrors the form: absent keeps the stored key, a string
 * replaces it, and `null` clears it. A form that always sent a value would
 * wipe the key every time the admin edited the persona.
 *
 * Takes the whole body so the narrowing lives here instead of at each caller.
 */
export function readApiKey(body: unknown): string | null | undefined {
  if (!body || typeof body !== "object" || !("apiKey" in body)) return undefined;

  const raw = body.apiKey;
  if (raw === null) return null;
  if (typeof raw !== "string") return undefined;
  return raw.trim().slice(0, LIMITS.apiKeyMax) || undefined;
}
