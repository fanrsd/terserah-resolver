import { NextResponse } from "next/server";
import { canStoreSecrets } from "@/lib/secret";
import { saveSettings } from "@/lib/settings";
import { normalizeSettings, readApiKey } from "@/lib/settings-schema";
import { hasSupabase } from "@/lib/supabase";

export async function POST(request: Request) {
  if (!hasSupabase) {
    return NextResponse.json({ error: "no_supabase" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const next = normalizeSettings(body);
  if (!next) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const apiKey = readApiKey(body);
  if (typeof apiKey === "string" && !canStoreSecrets) {
    return NextResponse.json({ error: "no_encryption_key" }, { status: 400 });
  }

  if (!(await saveSettings(next, apiKey))) {
    return NextResponse.json({ error: "write_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
