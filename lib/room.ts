import { Redis } from "@upstash/redis";

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

type Store = {
  get(id: string): Promise<Room | null>;
  put(room: Room): Promise<void>;
};

function upstash(url: string, token: string): Store {
  const redis = new Redis({ url, token });
  return {
    async get(id) {
      return (await redis.get<Room>(`room:${id}`)) ?? null;
    },
    async put(room) {
      await redis.set(`room:${room.id}`, room, { ex: ROOM_TTL_SECONDS });
    },
  };
}

// ponytail: dev-only store so the app runs with an empty .env. Single process,
// lost on restart. Swap to Upstash by setting the two env vars.
function memory(): Store {
  const rooms = new Map<string, { room: Room; expiresAt: number }>();
  return {
    async get(id) {
      const hit = rooms.get(id);
      if (!hit) return null;
      if (Date.now() > hit.expiresAt) {
        rooms.delete(id);
        return null;
      }
      return hit.room;
    },
    async put(room) {
      rooms.set(room.id, {
        room,
        expiresAt: Date.now() + ROOM_TTL_SECONDS * 1000,
      });
    },
  };
}

const globalForStore = globalThis as unknown as { __terserahStore?: Store };

/**
 * Built lazily and memoized per isolate. On Cloudflare Workers `process.env`
 * is populated per request, so choosing the backend at module scope would
 * always pick the in-memory store.
 */
export function store(): Store {
  if (globalForStore.__terserahStore) return globalForStore.__terserahStore;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  globalForStore.__terserahStore =
    url && token ? upstash(url, token) : memory();
  return globalForStore.__terserahStore;
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
