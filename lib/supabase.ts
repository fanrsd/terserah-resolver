import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only, service-role client. RLS denies anon outright (see
 * supabase/schema.sql), so this key must never reach the browser.
 * Null when unconfigured: the app runs, the admin surfaces say so.
 *
 * Built lazily and memoized per isolate. On Cloudflare Workers `process.env`
 * is populated per request, so constructing the client at module scope would
 * capture undefined credentials at isolate start.
 */
const cache = globalThis as unknown as {
  __terserahSupabase?: SupabaseClient | null;
};

export function hasSupabase(): boolean {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function supabase(): SupabaseClient | null {
  if (cache.__terserahSupabase !== undefined) return cache.__terserahSupabase;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  cache.__terserahSupabase =
    url && serviceKey
      ? createClient(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;

  return cache.__terserahSupabase;
}
