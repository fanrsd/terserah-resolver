import type { Room, Verdict } from "./room.ts";
import { supabase } from "./supabase.ts";

export type CaseRow = {
  id: string;
  city: string;
  a_choice: string;
  state: Room["state"];
  b_dealbreakers: string[] | null;
  verdict_place: string | null;
  verdict_reason: string | null;
  maps_query: string | null;
  fallback: boolean;
  place_verified: boolean | null;
  judge_ms: number | null;
  created_at: string;
  decided_at: string | null;
};

export type Stats = {
  total: number;
  awaiting: number;
  protested: number;
  surrendered: number;
  fallback: number;
  /** Cases where B opened nothing. PRODUCT.md's primary metric to beat. */
  abandonRate: number;
  protestRate: number;
  medianJudgeMs: number | null;
};

/**
 * History is analytics, never a dependency of the user flow. Every call here
 * swallows its own failure: a broken Supabase must not cost anyone dinner.
 */
export async function recordCase(room: Room): Promise<void> {
  const db = supabase();
  if (!db) return;
  try {
    await db.from("cases").insert({
      id: room.id,
      city: room.city,
      a_choice: room.aChoice,
      state: room.state,
      created_at: new Date(room.createdAt).toISOString(),
    });
  } catch {
    // analytics only
  }
}

export async function recordVerdict(
  room: Room,
  verdict: Verdict,
  judgeMs: number,
): Promise<void> {
  const db = supabase();
  if (!db) return;
  try {
    await db.from("cases")
      .update({
        state: "decided",
        b_dealbreakers: room.bDealbreakers ?? null,
        verdict_place: verdict.place,
        verdict_reason: verdict.reasoning,
        maps_query: verdict.mapsQuery,
        fallback: Boolean(verdict.fallback),
        place_verified: verdict.placeVerified ?? null,
        judge_ms: judgeMs,
        decided_at: new Date().toISOString(),
      })
      .eq("id", room.id);
  } catch {
    // analytics only
  }
}

export const PAGE_SIZE = 25;

export async function listCases(
  page: number,
  filter: "all" | "decided" | "awaiting" | "fallback",
): Promise<{ rows: CaseRow[]; total: number }> {
  const db = supabase();
  if (!db) return { rows: [], total: 0 };

  let query = db
    .from("cases")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  if (filter === "decided") query = query.eq("state", "decided");
  if (filter === "awaiting") query = query.eq("state", "awaiting_b");
  if (filter === "fallback") query = query.eq("fallback", true);

  const { data, count, error } = await query;
  if (error) return { rows: [], total: 0 };
  return { rows: (data ?? []) as CaseRow[], total: count ?? 0 };
}

export async function getStats(): Promise<Stats | null> {
  const db = supabase();
  if (!db) return null;

  const { data, error } = await db.from("cases")
    .select("state, fallback, b_dealbreakers, judge_ms")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error || !data) return null;

  let awaiting = 0;
  let protested = 0;
  let surrendered = 0;
  let fallback = 0;
  const durations: number[] = [];

  for (const row of data) {
    if (row.state === "decided") {
      if (row.b_dealbreakers?.length) protested++;
      else surrendered++;
      if (row.fallback) fallback++;
      if (typeof row.judge_ms === "number") durations.push(row.judge_ms);
    } else {
      awaiting++;
    }
  }

  durations.sort((a, b) => a - b);
  const total = data.length;

  return {
    total,
    awaiting,
    protested,
    surrendered,
    fallback,
    abandonRate: total ? awaiting / total : 0,
    protestRate: total ? protested / total : 0,
    medianJudgeMs: durations.length
      ? durations[Math.floor(durations.length / 2)]
      : null,
  };
}
