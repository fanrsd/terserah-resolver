import { NextResponse } from "next/server";
import { recordCase } from "@/lib/history";
import { overRateLimit } from "@/lib/ratelimit";
import { getSettings } from "@/lib/settings";
import {
  cleanLine,
  createRoom,
  MAX_CHOICE_LENGTH,
  MAX_CITY_LENGTH,
  ROOM_TTL_SECONDS,
  store,
} from "@/lib/room";

export async function POST(request: Request) {
  if ((await getSettings()).paused) {
    return NextResponse.json({ error: "paused" }, { status: 503 });
  }

  // Public, unauthenticated, and every room costs a model call. Rate limiting
  // is the trust boundary, not an optimization.
  if (await overRateLimit(request, "terserah:create", 5, "1 h")) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const choice = cleanLine(body?.choice, MAX_CHOICE_LENGTH);
  const city = cleanLine(body?.city, MAX_CITY_LENGTH);

  if (choice.length < 2 || city.length < 2) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const room = createRoom(choice, city);
  await store().put(room);
  // Awaited so the row exists before a fast responder tries to update it.
  await recordCase(room);

  const response = NextResponse.json({ id: room.id });
  // Path-scoped: only the room page needs to know who opened the case.
  response.cookies.set(`ta_${room.id}`, "1", {
    path: `/r/${room.id}`,
    maxAge: ROOM_TTL_SECONDS,
    sameSite: "lax",
    httpOnly: true,
  });
  return response;
}
