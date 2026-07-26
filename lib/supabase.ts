import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const hasSupabase = Boolean(url && serviceKey);

/**
 * Server-only, service-role client. RLS denies anon outright (see
 * supabase/schema.sql), so this key must never reach the browser.
 * Null when unconfigured: the app runs, the admin surfaces say so.
 */
export const supabase: SupabaseClient | null =
  url && serviceKey
    ? createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
