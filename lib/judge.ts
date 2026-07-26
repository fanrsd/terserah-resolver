import type { Room, Verdict } from "./room.ts";
import { getProviderKey, getSettings } from "./settings.ts";
import { completionsUrl, type Settings } from "./settings-schema.ts";

// Env is read inside functions, never at module scope: on Cloudflare Workers
// `process.env` is populated per request.

/**
 * Total wall-clock the judge may spend, across every attempt.
 *
 * Cloudflare closes a request that produces nothing for ~100s with a 524, so
 * this is a platform ceiling rather than a preference — which is why it is a
 * constant and not an admin setting: the knob could only ever go down.
 *
 * It used to be a flat 12s per call, picked when the only provider was Gemini
 * Flash (1-3s). A reasoning model behind an OpenAI-compatible endpoint can
 * legitimately think for 30-60s, so every call aborted and every verdict fell
 * back. Budgeting the whole judge instead of each fetch means a slow model gets
 * its one honest attempt, and the fallback still lands before Cloudflare gives up.
 */
const JUDGE_BUDGET_MS = 75_000;

/** Below this there is no point starting another call. */
const MIN_ATTEMPT_MS = 6_000;

function remaining(deadline: number): number {
  return deadline - Date.now();
}

const FIELDS = {
  place: { type: "string", description: "Nama tempat makan, HURUF KAPITAL SEMUA" },
  maps_query: {
    type: "string",
    description: "Kata kunci pencarian Google Maps: 'nama tempat, kota'",
  },
  reasoning: {
    type: "string",
    description: "Maksimal 2 kalimat. Wajib menyindir kedua pihak.",
  },
} as const;

const REQUIRED = ["place", "maps_query", "reasoning"];

function prompt(room: Room, avoid?: string): string {
  const preamble = `Kota: ${room.city}\nPihak A menetapkan: "${room.aChoice}"`;
  const retry = avoid
    ? `\n\nPENTING: "${avoid}" tidak ditemukan di ${room.city}. Pilih tempat lain yang benar-benar ada.`
    : "";

  if (room.bDealbreakers?.length) {
    return `${preamble}
Pihak B menolak dan mengajukan 3 keberatan:
${room.bDealbreakers.map((d, i) => `${i + 1}. ${d}`).join("\n")}

Tetapkan satu tempat di ${room.city} yang memenuhi semua keberatan Pihak B.
Dalam alasanmu, sindir Pihak B karena baru bersuara setelah diancam pilihan buruk,
dan sindir Pihak A karena sengaja memilih "${room.aChoice}" untuk memancing.${retry}`;
  }

  return `${preamble}
Pihak B tidak mengajukan keberatan apa pun. Dia menyerah.

Putusanmu WAJIB tetap "${room.aChoice}". Jangan ganti.
Dalam alasanmu, sindir Pihak B karena diam saja padahal jelas tidak suka,
dan sindir Pihak A karena menang tanpa perlawanan bukan berarti seleranya bagus.${retry}`;
}

/* ------------------------------------------------------------- providers -- */

async function callGemini(
  room: Room,
  settings: Settings,
  key: string,
  deadline: number,
  avoid?: string,
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: settings.persona }] },
        contents: [{ role: "user", parts: [{ text: prompt(room, avoid) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              place: { type: "STRING", description: FIELDS.place.description },
              maps_query: {
                type: "STRING",
                description: FIELDS.maps_query.description,
              },
              reasoning: {
                type: "STRING",
                description: FIELDS.reasoning.description,
              },
            },
            required: REQUIRED,
            propertyOrdering: REQUIRED,
          },
          temperature: settings.temperature,
        },
      }),
      signal: AbortSignal.timeout(remaining(deadline)),
    },
  );

  if (!response.ok) throw new Error(`gemini ${response.status}`);
  const payload = await response.json();
  return payload?.candidates?.[0]?.content?.parts?.[0]?.text;
}

const JSON_SCHEMA_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "putusan",
    strict: true,
    schema: {
      type: "object",
      properties: FIELDS,
      required: REQUIRED,
      additionalProperties: false,
    },
  },
};

/**
 * Any OpenAI-compatible `/chat/completions` endpoint: OpenAI, OpenRouter, Groq,
 * DeepSeek, vLLM, Ollama, LM Studio, or a self-hosted gateway.
 *
 * Structured output support is uneven across those, so this degrades on its own
 * rather than exposing a knob: json_schema first, then json_object, then plain
 * text. `parseVerdict` is the backstop for whatever comes back.
 *
 * Degradation only fires on 400/422 — "this server doesn't know that format".
 * A timeout is not that, and retrying a reasoning model in a slower mode would
 * spend the entire budget confirming it is slow, so it propagates immediately.
 */
async function callOpenAI(
  room: Room,
  settings: Settings,
  key: string,
  deadline: number,
  avoid?: string,
): Promise<string> {
  const url = completionsUrl(settings.baseUrl);
  const formats = [JSON_SCHEMA_FORMAT, { type: "json_object" }, null];
  let lastStatus = 0;

  for (const responseFormat of formats) {
    if (remaining(deadline) < MIN_ATTEMPT_MS) break;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: settings.model,
        temperature: settings.temperature,
        messages: [
          { role: "system", content: settings.persona },
          { role: "user", content: prompt(room, avoid) },
        ],
        ...(responseFormat ? { response_format: responseFormat } : {}),
      }),
      signal: AbortSignal.timeout(remaining(deadline)),
    });

    if (response.ok) {
      const payload = await response.json();
      return payload?.choices?.[0]?.message?.content;
    }

    lastStatus = response.status;
    if (lastStatus !== 400 && lastStatus !== 422) break;
  }

  throw new Error(`openai-compatible ${lastStatus}`);
}

/* ---------------------------------------------------------------- parsing -- */

/** Exported for tests: malformed model output must never reach a screen. */
export function parseVerdict(text: unknown): Verdict {
  if (typeof text !== "string") throw new Error("no text in model response");

  // Local models like to wrap JSON in ```json fences or chat around it.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no json object in response");

  const parsed = JSON.parse(body.slice(start, end + 1));
  const place = typeof parsed.place === "string" ? parsed.place.trim() : "";
  const reasoning =
    typeof parsed.reasoning === "string" ? parsed.reasoning.trim() : "";
  const mapsQuery =
    typeof parsed.maps_query === "string" ? parsed.maps_query.trim() : "";

  if (!place || !reasoning) throw new Error("model omitted a required field");

  return {
    place: place.toUpperCase(),
    mapsQuery: mapsQuery || place,
    reasoning,
  };
}

/* ------------------------------------------------------------ place check -- */

/**
 * Confirms the place exists, without ever asking Google to name it.
 *
 * The `places.id` field mask keeps this on Text Search Essentials (IDs Only):
 * unlimited and free. Adding any name-bearing field (`displayName`,
 * `formattedAddress`) silently promotes the call to Pro at $32/1k.
 */
async function placeExists(query: string): Promise<boolean> {
  try {
    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY as string,
          "X-Goog-FieldMask": "places.id",
        },
        body: JSON.stringify({
          textQuery: query,
          maxResultCount: 1,
          languageCode: "id",
          regionCode: "ID",
        }),
        signal: AbortSignal.timeout(6_000),
      },
    );
    if (!response.ok) return true;
    const payload = await response.json();
    return Array.isArray(payload.places) && payload.places.length > 0;
  } catch {
    return true; // the check is a nicety; never let it fail a verdict
  }
}

/* ------------------------------------------------------------------ judge -- */

export async function callProvider(
  room: Room,
  settings: Settings,
  key: string,
  avoid?: string,
  deadline = Date.now() + JUDGE_BUDGET_MS,
): Promise<Verdict> {
  const raw =
    settings.provider === "openai"
      ? await callOpenAI(room, settings, key, deadline, avoid)
      : await callGemini(room, settings, key, deadline, avoid);
  return parseVerdict(raw);
}

/**
 * Always resolves. A broken judge hands the decision back to A rather than
 * showing an error, because this screen is the entire growth loop.
 *
 * Every attempt draws from one shared deadline, so a slow model gets a real
 * chance instead of two truncated ones, and the fallback still returns before
 * Cloudflare times the request out.
 */
export async function judge(room: Room): Promise<Verdict> {
  const deadline = Date.now() + JUDGE_BUDGET_MS;
  const [settings, key] = await Promise.all([getSettings(), getProviderKey()]);
  const surrendered = !room.bDealbreakers?.length;
  const checking =
    settings.placeCheck && Boolean(process.env.GOOGLE_PLACES_API_KEY);

  if (key) {
    while (remaining(deadline) >= MIN_ATTEMPT_MS) {
      try {
        const verdict = await callProvider(room, settings, key, undefined, deadline);

        // B surrendered: A's pick stands, whatever the model felt like writing.
        if (surrendered) {
          verdict.place = room.aChoice.toUpperCase();
          verdict.mapsQuery = `${room.aChoice}, ${room.city}`;
          return verdict;
        }
        if (!checking) return verdict;
        if (await placeExists(verdict.mapsQuery)) {
          return { ...verdict, placeVerified: true };
        }

        // Only re-ask if there is time; otherwise keep the unverified pick,
        // which is still a real verdict and beats the fallback.
        if (remaining(deadline) < MIN_ATTEMPT_MS) {
          return { ...verdict, placeVerified: false };
        }
        const second = await callProvider(
          room, settings, key, verdict.place, deadline,
        );
        return { ...second, placeVerified: await placeExists(second.mapsQuery) };
      } catch {
        // out of budget, or the endpoint failed; loop decides whether to retry
      }
    }
  }

  return {
    place: room.aChoice.toUpperCase(),
    mapsQuery: `${room.aChoice}, ${room.city}`,
    reasoning: surrendered
      ? "Tidak ada keberatan yang masuk. Pilihan Pihak A berlaku, dan Pihak B kehilangan haknya karena diam."
      : "Hakim berhalangan hadir. Karena tidak ada putusan baru, pilihan Pihak A tetap berlaku.",
    fallback: true,
  };
}
