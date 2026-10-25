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
npm run dev        # http://localhost:3000
npm test           # 18 tests, no network
npm run build

npm run cf:build   # build the Worker bundle
npm run cf:preview # run it in workerd locally
npm run cf:deploy  # ship to terserah.help
```

Supabase is the only hard dependency. Everything else degrades: with just
`SUPABASE_*` set the app runs end-to-end, the judge returns its fallback verdict,
and the admin panel stays locked. Copy `.env.example` and fill in what you have.

| Missing | What happens |
|---|---|
| all LLM keys | canned fallback verdict; the flow still demonstrates |
| `SETTINGS_ENCRYPTION_KEY` | the admin can't store an endpoint key; env only |
| `places` table empty | no existence check; the Maps search link still works |
| `SUPABASE_*` | **nothing works** — rooms, history and settings all live there |
| `ADMIN_PASSWORD` | `/admin` refuses to open at all |

## Supabase

Run [`supabase/schema.sql`](supabase/schema.sql) once in the SQL editor. It creates
`settings` (singleton), `cases` (rooms + history), `rate_hits`, and `places`, and
enables RLS with no policies — every access goes through the service role from the
server, so anon is denied outright, verified against all four verbs.

`places` starts empty and stays useless until it is filled: it is the existence
check for the restaurant the judge names, 1,084,930 food-venue names from
Foursquare Open Source Places. Google Places answers the same question but wants
a billing-enabled Cloud project; this wants neither key nor card. Load it with
`node --env-file=.env.local scripts/load-places.mjs places.txt` — see
[`supabase/migrations/0003_places.sql`](supabase/migrations/0003_places.sql) for
where `places.txt` comes from and what the index cannot do.

Rooms live here too. They were briefly in Redis — a KV workload on paper — but
Cloudflare Workers has no shared process memory, so a room existed only inside the
isolate that created it and B, arriving from another network and therefore another
colo, was told the case was closed. `cases` now holds one row that is both the live
room and its history entry, which removed a write rather than adding a store.
`expires_at` closes it to users after 24h; the row stays for the admin.

## Admin

`/admin` — case history, abandonment and protest rates, judge failures, latency.
`/admin/pengaturan` — provider, model, temperature, persona (system prompt), place
check, and a pause switch. Changes apply within 30 seconds.

### Custom endpoints

The judge speaks two dialects: Gemini's native API, or **any OpenAI-compatible
`/chat/completions`** — OpenAI, OpenRouter, Groq, DeepSeek, vLLM, Ollama, LM Studio,
or your own gateway. Pick "Endpoint sendiri" in the admin panel, paste a base URL
(with or without the `/chat/completions` suffix), and hit **Uji koneksi** before
saving; it runs one real verdict and tells you what to fix if it fails.

Structured output degrades on its own rather than exposing a knob: `json_schema`
first, then `json_object`, then plain text. Small local models usually land on the
second, and the parser still digs JSON out of a ```` ```json ```` fence.

A custom endpoint's key can be saved from the panel, encrypted with AES-GCM under
`SETTINGS_ENCRYPTION_KEY` — the master key stays in env, so a database snapshot alone
doesn't read it, and the value is never sent back to the browser. Without that env
var the field is disabled and the key must come from `LLM_API_KEY`; nothing is ever
stored in the clear. The Gemini key is env-only either way.

The Places field mask is hardcoded to `places.id`: it is the only mask that stays on
the free Text Search Essentials tier. Any name-bearing field silently promotes every
call to Pro at $32 per 1,000.

## Deploy

Cloudflare Workers via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare),
on Next's Node.js runtime (not Edge). `terserah.help` is wired as a custom domain in
[`wrangler.jsonc`](wrangler.jsonc); the zone must already exist on the account.

Secrets never live in `wrangler.jsonc`. Set them once:

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SETTINGS_ENCRYPTION_KEY
# then whichever of GEMINI_API_KEY / LLM_API_KEY you use
```

Three things the Workers runtime forced, all of them worth knowing before editing:

- **Env is read inside functions, never at module scope.** `process.env` is populated
  per request on Workers, so a module-scope read captures `undefined` at isolate
  start. Clients, limiters, and the room store are built lazily and memoized.
- **Fonts are inlined as base64** in `lib/og-fonts.ts` (`npm run fonts` regenerates
  from `assets/*.ttf`). Workers has no filesystem, and a Worker fetching its own
  public domain fails once deployed.
- **CI builds the deploy.** OpenNext does not guarantee Windows support. The build
  happens to work here, but [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
  runs it on Linux so what ships is never platform-dependent.

Bundle is ~2.0 MiB gzipped against Cloudflare's 3 MiB limit — check
`npx wrangler deploy --dry-run` before adding a large dependency.

## License

MIT. See [LICENSE](LICENSE).
