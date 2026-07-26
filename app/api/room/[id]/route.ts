import { NextResponse } from "next/server";
import { isRoomId, store } from "@/lib/room";

/** Poll target for A's waiting screen. State only; the page renders the rest. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isRoomId(id)) {
    return NextResponse.json({ state: "gone" }, { status: 404 });
  }

  const room = await store().get(id);
  return NextResponse.json(
    { state: room?.state ?? "gone" },
    { status: room ? 200 : 404, headers: { "cache-control": "no-store" } },
  );
}
