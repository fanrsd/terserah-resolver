import { NextResponse } from "next/server";
import { getRoom, isRoomId } from "@/lib/room";

/** Poll target for A's waiting screen. State only; the page renders the rest. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isRoomId(id)) {
    return NextResponse.json({ state: "gone" }, { status: 404 });
  }

  const room = await getRoom(id);
  return NextResponse.json(
    { state: room?.state ?? "gone" },
    { status: room ? 200 : 404, headers: { "cache-control": "no-store" } },
  );
}
