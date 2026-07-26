import { NextResponse } from "next/server";
import { callProvider } from "@/lib/judge";
import type { Room } from "@/lib/room";
import { getProviderKey } from "@/lib/settings";
import { normalizeSettings, readApiKey } from "@/lib/settings-schema";

/**
 * One real verdict against the settings currently in the form, before they are
 * saved. A typo'd base URL is the single most likely failure when pointing at a
 * custom endpoint, and without this the admin only finds out when a real couple
 * gets a fallback verdict.
 *
 * Admin-only, and the admin can already aim production traffic at any URL, so
 * this grants no capability the panel didn't already have.
 */
const PROBE: Room = {
  id: "uji000",
  city: "Jakarta Selatan",
  aChoice: "Warkop depan gang",
  state: "protested",
  bDealbreakers: ["Gak mau panas", "Gak mau jorok", "Pengen yang berkuah"],
  createdAt: Date.now(),
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const settings = normalizeSettings(body);
  if (!settings) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const typed = readApiKey(body);
  const key = typeof typed === "string" ? typed : await getProviderKey();
  if (!key) {
    return NextResponse.json(
      { ok: false, reason: "Tidak ada API key untuk provider ini." },
      { status: 200 },
    );
  }

  const startedAt = Date.now();
  try {
    const verdict = await callProvider(PROBE, settings, key);
    return NextResponse.json({
      ok: true,
      ms: Date.now() - startedAt,
      place: verdict.place,
      reasoning: verdict.reasoning,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      ms: Date.now() - startedAt,
      reason: explain(error),
    });
  }
}

/** The whole point of this endpoint is telling the admin what to go fix. */
function explain(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (error instanceof Error && error.name === "TimeoutError") {
    return "Endpoint tidak menjawab dalam 12 detik. Model terlalu besar, atau URL menggantung.";
  }
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i.test(message)) {
    return `Tidak bisa menghubungi endpoint (${message}). Cek base URL, port, dan apakah servernya jalan.`;
  }

  const status = message.match(/(\d{3})$/)?.[1];
  if (status === "401" || status === "403") {
    return `API key ditolak (${status}). Isi ulang key-nya.`;
  }
  if (status === "404") {
    return "404 dari endpoint. Base URL kemungkinan kurang atau kelebihan segmen — coba yang berakhir di /v1.";
  }
  if (status === "429") {
    return "429 — kena rate limit penyedia.";
  }
  if (status) {
    return `Endpoint menjawab ${status}. Cek nama model: "${message}".`;
  }
  if (/json/i.test(message)) {
    return `Terhubung, tapi jawabannya bukan JSON yang bisa dibaca (${message}). Model ini mungkin terlalu kecil untuk mengikuti format.`;
  }
  return message;
}
