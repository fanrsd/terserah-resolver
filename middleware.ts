import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, hasAdmin, verifyToken } from "@/lib/admin-auth";

/**
 * One gate in front of everything under /admin. Individual pages never
 * re-check, so there is exactly one place this can be got wrong.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLogin =
    pathname === "/admin/login" || pathname === "/api/admin/login";

  if (isLogin) return NextResponse.next();

  if (!hasAdmin()) {
    return new NextResponse("Admin belum dikonfigurasi (ADMIN_PASSWORD).", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  if (await verifyToken(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const login = request.nextUrl.clone();
  login.pathname = "/admin/login";
  login.search = "";
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
