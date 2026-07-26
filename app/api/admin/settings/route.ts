import { NextResponse } from "next/server";
import { hasSupabase } from "@/lib/supabase";
import { normalizeSettings } from "@/lib/settings-schema";
import { saveSettings } from "@/lib/settings";

export async function POST(request: Request) {
  if (!hasSupabase) {
    return NextResponse.json({ error: "no_supabase" }, { status: 503 });
  }

  const next = normalizeSettings(await request.json().catch(() => null));
  if (!next) return NextResponse.json({ error: "invalid" }, { status: 400 });

  if (!(await saveSettings(next))) {
    return NextResponse.json({ error: "write_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
