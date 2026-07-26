import { NextResponse } from "next/server";
import { judge } from "@/lib/judge";
import {
  accept,
  cleanDealbreakers,
  getRoom,
  isRoomId,
  protest,
  saveResponse,
  saveVerdict,
} from "@/lib/room";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isRoomId(id)) {
    return NextResponse.json({ error: "gone" }, { status: 404 });
  }

  const room = await getRoom(id);
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

  // Persist first, so A's screen can switch from "waiting" to "the judge is
  // considering it" while the model runs. The write is guarded on the row
  // still being `awaiting_b`, so if both parties respond at once exactly one
  // wins and only one model call is ever bought.
  if (!(await saveResponse(responded))) {
    return NextResponse.json({ state: "taken" }, { status: 409 });
  }

  const startedAt = Date.now();
  const verdict = await judge(responded);
  await saveVerdict(responded, verdict, Date.now() - startedAt);

  return NextResponse.json({ state: "decided" });
}
