import { supabase } from "./supabase.ts";

export const ROOM_TTL_SECONDS = 60 * 60 * 24;

export type RoomState = "awaiting_b" | "accepted" | "protested" | "decided";

export type Verdict = {
  /** Place name, already uppercased by the judge. */
  place: string;
  /** Fed straight into a Google Maps search URL. */
  mapsQuery: string;
  /** One or two sentences. Must land on both parties. */
  reasoning: string;
  /** True when the judge fell over and we handed the decision back to A. */
  fallback?: boolean;
  /** Free IDs-only Places check: true/false when run, undefined when skipped. */
  placeVerified?: boolean;
};

export type Room = {
  id: string;
  city: string;
  /** A's deliberately unappealing pick. Already in effect when B arrives. */
  aChoice: string;
  state: RoomState;
  bDealbreakers?: string[];
  verdict?: Verdict;
  createdAt: number;
  judgeMs?: number;
};

/** No 0/1/l/o to keep links dictatable over a phone call. */
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

export function newRoomId(length = 6): string {
  // 256 % 32 === 0, so the modulo below is unbiased.
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return out;
}

export function isRoomId(value: string): boolean {
  return value.length === 6 && [...value].every((c) => ALPHABET.includes(c));
}

/* ---------------------------------------------------------------- store -- */

/**
 * Rooms live in Postgres, in the same `cases` row that carries the history.
 *
 * They used to live in Redis with the history written separately. On Cloudflare
 * Workers there is no shared process memory, so the in-memory fallback made a
 * room visible only to the isolate that created it — B, arriving from another
 * network and therefore another colo, would be told the case was closed.
 *
 * Merging the two removed the duplicate write instead of adding a third store:
 * one row per room, created when A opens the case and updated when it is
 * decided. `expires_at` closes the room to users after 24h while the row stays
 * for the admin history.
 */
type CaseRow = {
  id: string;
  city: string;
  a_choice: string;
  state: RoomState;
  b_dealbreakers: string[] | null;
  verdict_place: string | null;
  verdict_reason: string | null;
  maps_query: string | null;
  fallback: boolean;
  place_verified: boolean | null;
  judge_ms: number | null;
  created_at: string;
  expires_at: string;
};

function toRoom(row: CaseRow): Room {
  const verdict: Verdict | undefined = row.verdict_place
    ? {
        place: row.verdict_place,
        mapsQuery: row.maps_query ?? row.verdict_place,
        reasoning: row.verdict_reason ?? "",
        fallback: row.fallback,
        placeVerified: row.place_verified ?? undefined,
      }
    : undefined;

  return {
    id: row.id,
    city: row.city,
    aChoice: row.a_choice,
    state: row.state,
    bDealbreakers: row.b_dealbreakers ?? undefined,
    verdict,
    createdAt: Date.parse(row.created_at),
    judgeMs: row.judge_ms ?? undefined,
  };
}

export async function getRoom(id: string): Promise<Room | null> {
  const db = supabase();
  if (!db) return null;

  const { data, error } = await db
    .from("cases")
    .select("*")
    .eq("id", id)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;
  return toRoom(data as CaseRow);
}

export async function insertRoom(room: Room): Promise<boolean> {
  const db = supabase();
  if (!db) return false;

  const { error } = await db.from("cases").insert({
    id: room.id,
    city: room.city,
    a_choice: room.aChoice,
    state: room.state,
    created_at: new Date(room.createdAt).toISOString(),
    expires_at: new Date(room.createdAt + ROOM_TTL_SECONDS * 1000).toISOString(),
  });
  return !error;
}

/**
 * Guarded by the current state, so two people responding at once cannot both
 * win: the update only applies while the row is still `awaiting_b`.
 */
export async function saveResponse(room: Room): Promise<boolean> {
  const db = supabase();
  if (!db) return false;

  const { data, error } = await db
    .from("cases")
    .update({ state: room.state, b_dealbreakers: room.bDealbreakers ?? null })
    .eq("id", room.id)
    .eq("state", "awaiting_b")
    .select("id");

  return !error && (data?.length ?? 0) > 0;
}

export async function saveVerdict(
  room: Room,
  verdict: Verdict,
  judgeMs: number,
): Promise<void> {
  const db = supabase();
  if (!db) return;

  await db
    .from("cases")
    .update({
      state: "decided",
      verdict_place: verdict.place,
      verdict_reason: verdict.reasoning,
      maps_query: verdict.mapsQuery,
      fallback: Boolean(verdict.fallback),
      place_verified: verdict.placeVerified ?? null,
      judge_ms: judgeMs,
      decided_at: new Date().toISOString(),
    })
    .eq("id", room.id)
    .neq("state", "decided");
}

/* -------------------------------------------------------- state machine -- */

export const MAX_CHOICE_LENGTH = 80;
export const MAX_CITY_LENGTH = 60;
export const MAX_DEALBREAKER_LENGTH = 60;
export const DEALBREAKER_COUNT = 3;

export function createRoom(aChoice: string, city: string): Room {
  return {
    id: newRoomId(),
    city,
    aChoice,
    state: "awaiting_b",
    createdAt: Date.now(),
  };
}

/**
 * B accepts: A's choice stands, and the judge writes a short note about it.
 * Terminal, so a double-tap can't burn a second model call.
 */
export function accept(room: Room): Room {
  if (room.state !== "awaiting_b") return room;
  return { ...room, state: "accepted" };
}

export function protest(room: Room, dealbreakers: string[]): Room {
  if (room.state !== "awaiting_b") return room;
  return { ...room, state: "protested", bDealbreakers: dealbreakers };
}

export function decide(room: Room, verdict: Verdict): Room {
  if (room.state === "decided") return room;
  return { ...room, state: "decided", verdict };
}

/* -------------------------------------------------------------- inputs -- */

export function cleanLine(input: unknown, max: number): string {
  if (typeof input !== "string") return "";
  return input.replace(/\s+/g, " ").trim().slice(0, max);
}

export function cleanDealbreakers(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const cleaned = input
    .map((v) => cleanLine(v, MAX_DEALBREAKER_LENGTH))
    .filter(Boolean);
  return cleaned.length === DEALBREAKER_COUNT ? cleaned : null;
}

export function mapsUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
