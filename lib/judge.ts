import { getSettings } from "./settings.ts";
import type { Settings } from "./settings-schema.ts";
import type { Room, Verdict } from "./room.ts";

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;

const TIMEOUT_MS = 12_000;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    place: {
      type: "STRING",
      description: "Nama tempat makan, HURUF KAPITAL SEMUA",
    },
    maps_query: {
      type: "STRING",
      description: "Kata kunci pencarian Google Maps: 'nama tempat, kota'",
    },
    reasoning: {
      type: "STRING",
      description: "Maksimal 2 kalimat. Wajib menyindir kedua pihak.",
    },
  },
  required: ["place", "maps_query", "reasoning"],
  propertyOrdering: ["place", "maps_query", "reasoning"],
};

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

async function callModel(
  room: Room,
  settings: Settings,
  avoid?: string,
): Promise<Verdict> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": GEMINI_KEY as string,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: settings.persona }] },
        contents: [{ role: "user", parts: [{ text: prompt(room, avoid) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
          temperature: settings.temperature,
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    throw new Error(`gemini ${response.status}`);
  }

  const payload = await response.json();
  return parseVerdict(payload?.candidates?.[0]?.content?.parts?.[0]?.text);
}

/** Exported for tests: malformed model output must never reach a screen. */
export function parseVerdict(text: unknown): Verdict {
  if (typeof text !== "string") throw new Error("no text in model response");

  const parsed = JSON.parse(text);
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
          "X-Goog-Api-Key": PLACES_KEY as string,
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

/**
 * Always resolves. A broken judge hands the decision back to A rather than
 * showing an error, because this screen is the entire growth loop.
 */
export async function judge(room: Room): Promise<Verdict> {
  const settings = await getSettings();
  const surrendered = !room.bDealbreakers?.length;
  const checking = settings.placeCheck && Boolean(PLACES_KEY);

  if (GEMINI_KEY) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const verdict = await callModel(room, settings);

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

        const second = await callModel(room, settings, verdict.place);
        return { ...second, placeVerified: await placeExists(second.mapsQuery) };
      } catch {
        // fall through to the next attempt, then to the fallback below
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
