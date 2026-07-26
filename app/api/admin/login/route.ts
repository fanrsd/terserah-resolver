import { NextResponse } from "next/server";
import { overRateLimit } from "@/lib/ratelimit";
import {
  ADMIN_COOKIE,
  checkPassword,
  hasAdmin,
  issueToken,
  SESSION_SECONDS,
} from "@/lib/admin-auth";



export async function POST(request: Request) {
  if (!hasAdmin()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  // The one endpoint the middleware lets through unauthenticated, so it is the
  // one that has to survive a brute force.
  if (await overRateLimit(request, "terserah:admin-login", 10, "15 m")) {
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
