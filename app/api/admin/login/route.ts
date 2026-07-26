import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  checkPassword,
  hasAdmin,
  issueToken,
  SESSION_SECONDS,
} from "@/lib/admin-auth";

// The one endpoint the middleware lets through unauthenticated, so it is the
// one that has to survive a brute force.
const limiter =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(10, "15 m"),
        prefix: "terserah:admin-login",
      })
    : null;

export async function POST(request: Request) {
  if (!hasAdmin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (limiter && !(await limiter.limit(ip)).success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (!(await checkPassword(body?.password))) {
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, await issueToken(), {
    path: "/",
    maxAge: SESSION_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
