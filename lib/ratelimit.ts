import { supabase } from "./supabase.ts";

/**
 * Rate limiting on Postgres rather than Redis.
 *
 * Upstash was never provisioned, and Cloudflare's native ratelimit binding only
 * supports 10s and 60s windows — "5 rooms per hour" does not fit. Supabase is
 * already a hard dependency, so this costs one table instead of one vendor.
 *
 * Fails open: if the count query errors the request proceeds. A limiter that
 * takes the site down when the database hiccups is worse than the abuse it
 * prevents, and the endpoints behind it are already cheap.
 */
export async function overRateLimit(
  request: Request,
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const db = supabase();
  if (!db) return false;

  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown";

  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { count, error } = await db
    .from("rate_hits")
    .select("id", { count: "exact", head: true })
    .eq("bucket", bucket)
    .eq("ip", ip)
    .gt("at", since);

  if (error) return false;
  if ((count ?? 0) >= limit) return true;

  await db.from("rate_hits").insert({ bucket, ip });

  // Opportunistic cleanup: no cron, and the table stays small on its own.
  if (Math.random() < 0.02) {
    await db
      .from("rate_hits")
      .delete()
      .lt("at", new Date(Date.now() - 86_400_000).toISOString());
  }

  return false;
}
