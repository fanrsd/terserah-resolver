-- Cloudflare Workers has no shared process memory and Upstash was never
-- provisioned, so rooms move into Postgres. `cases` already carried one row per
-- room for history; it now carries the live room too, which removes the second
-- write rather than adding a store.

alter table public.cases
  add column if not exists expires_at timestamptz not null
  default (now() + interval '24 hours');

create index if not exists cases_expires_at_idx on public.cases (expires_at);

-- Rate limiting without Redis. Cloudflare's native ratelimit binding only
-- supports 10s/60s windows, which does not fit "5 rooms per hour".
create table if not exists public.rate_hits (
  id     bigserial primary key,
  bucket text not null,
  ip     text not null,
  at     timestamptz not null default now()
);

create index if not exists rate_hits_lookup_idx
  on public.rate_hits (bucket, ip, at desc);

alter table public.rate_hits enable row level security;
