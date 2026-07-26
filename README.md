# Terserah

Pengadilan untuk orang yang bilang "terserah" lalu menolak semua saranmu.

A sets one place. B opens the link and finds the decision already in effect. Protesting
means finally saying what they *don't* want — and the judge closes the case, roasting
both sides.

Design rationale: [`docs/plans/2026-07-26-terserah-resolver-design.md`](docs/plans/2026-07-26-terserah-resolver-design.md).
Visual system: [`DESIGN.md`](DESIGN.md).

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # 12 tests, no network
npm run build
```

Every integration is optional. With an empty `.env.local` the app still runs
end-to-end — rooms live in memory, the judge returns its fallback verdict, and the
admin panel stays locked. Copy `.env.example` and fill in what you have.

| Missing | What happens |
|---|---|
| `UPSTASH_REDIS_*` | in-memory room store, no rate limiting (dev only) |
| `GEMINI_API_KEY` | canned verdict; the flow still demonstrates |
| `GOOGLE_PLACES_API_KEY` | no existence check; the Maps search link still works |
| `SUPABASE_*` | default settings, no history recorded |
| `ADMIN_PASSWORD` | `/admin` refuses to open at all |

## Supabase

Run [`supabase/schema.sql`](supabase/schema.sql) once in the SQL editor. It creates
`settings` (singleton) and `cases` (history), and enables RLS with no policies — every
access goes through the service role from the server, so anon is denied outright.

Rooms deliberately do **not** live here. They are ephemeral, TTL'd, and polled every
two seconds; that is a KV workload, and it stays in Redis.

## Admin

`/admin` — case history, abandonment and protest rates, judge failures, latency.
`/admin/pengaturan` — persona (system prompt), model, temperature, place check, and a
pause switch. Changes apply within 30 seconds.

API keys are **not** editable there, on purpose. The Places field mask is hardcoded to
`places.id`: it is the only mask that stays on the free Text Search Essentials tier.
Any name-bearing field silently promotes every call to Pro at $32 per 1,000.
