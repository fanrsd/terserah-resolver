import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Memoized per isolate and built on first use. On Cloudflare Workers
 * `process.env` is populated per request, so a module-scope `Redis.fromEnv()`
 * would throw or silently produce an unusable client at isolate start.
 *
 * Without Redis there is no limiter and nothing is limited — acceptable in
 * local dev, which is the only place that configuration should ever happen.
 */
const cache = globalThis as unknown as {
  __terserahLimiters?: Map<string, Ratelimit>;
};

export async function overRateLimit(
  request: Request,
  prefix: string,
  tokens: number,
  window: Duration,
): Promise<boolean> {
  if (!process.env.UPSTASH_REDIS_REST_URL) return false;
  if (!process.env.UPSTASH_REDIS_REST_TOKEN) return false;

  const limiters = (cache.__terserahLimiters ??= new Map());
  let limiter = limiters.get(prefix);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(tokens, window),
      prefix,
    });
    limiters.set(prefix, limiter);
  }

  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown";

  return !(await limiter.limit(ip)).success;
}
