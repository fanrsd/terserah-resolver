import { NextResponse } from "next/server";
import { recordVerdict } from "@/lib/history";
import { judge } from "@/lib/judge";
import {
  accept,
  cleanDealbreakers,
  decide,
  isRoomId,
  protest,
  store,
} from "@/lib/room";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isRoomId(id)) {
    return NextResponse.json({ error: "gone" }, { status: 404 });
  }

  const room = await store.get(id);
  if (!room) return NextResponse.json({ error: "gone" }, { status: 404 });

  // Idempotent: a double tap, a retry, or a second tab must not buy another
  // model call or overwrite a verdict both parties have already read.
  if (room.state === "decided") {
    return NextResponse.json({ state: room.state });
  }
  if (room.state !== "awaiting_b") {
    return NextResponse.json({ state: room.state }, { status: 409 });
  }

  const body = await request.json().catch(() => null);

  let responded;
  if (body?.action === "protest") {
    const dealbreakers = cleanDealbreakers(body?.dealbreakers);
    if (!dealbreakers) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    responded = protest(room, dealbreakers);
  } else if (body?.action === "accept") {
    responded = accept(room);
  } else {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  // Persist before deliberating so A's screen can switch from "waiting" to
  // "the judge is considering it" while the model runs.
  await store.put(responded);

  const startedAt = Date.now();
  const verdict = await judge(responded);
  await store.put(decide(responded, verdict));
  await recordVerdict(responded, verdict, Date.now() - startedAt);

  return NextResponse.json({ state: "decided" });
}
