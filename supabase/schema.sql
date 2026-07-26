-- Terserah — admin storage.
-- Rooms stay in Redis (hot, 24h TTL, polled every 2s). Supabase holds the two
-- things that must outlive a room: tunable settings and the case history.
--
-- Run once in the Supabase SQL editor.

create table if not exists public.settings (
  id          boolean primary key default true constraint settings_singleton check (id),
  provider    text    not null default 'gemini' check (provider in ('gemini', 'openai')),
  -- Base URL of any OpenAI-compatible /chat/completions endpoint.
  base_url    text    not null default '',
  model       text    not null default 'gemini-2.5-flash',
  temperature real    not null default 1.1 check (temperature >= 0 and temperature <= 2),
  persona     text    not null default '',
  place_check boolean not null default true,
  paused      boolean not null default false,
  -- AES-GCM blob, base64(iv || ciphertext). Master key lives in
  -- SETTINGS_ENCRYPTION_KEY, never here. Null means "fall back to env".
  api_key_cipher text,
  updated_at  timestamptz not null default now()
);

-- Existing installs: create table if not exists skips the columns above.
alter table public.settings add column if not exists provider text not null default 'gemini';
alter table public.settings add column if not exists base_url text not null default '';
alter table public.settings add column if not exists api_key_cipher text;

insert into public.settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.cases (
  id              text primary key,
  city            text not null,
  a_choice        text not null,
  -- awaiting_b rows that never move are the abandonment metric.
  state           text not null default 'awaiting_b',
  b_dealbreakers  text[],
  verdict_place   text,
  verdict_reason  text,
  maps_query      text,
  -- true when the model failed and the decision fell back to A's pick.
  fallback        boolean not null default false,
  place_verified  boolean,
  judge_ms        integer,
  created_at      timestamptz not null default now(),
  decided_at      timestamptz
);

create index if not exists cases_created_at_idx on public.cases (created_at desc);
create index if not exists cases_state_idx on public.cases (state);

-- Every read and write goes through the service role from the server.
-- Enabling RLS with no policies denies anon and authenticated outright.
alter table public.settings enable row level security;
alter table public.cases    enable row level security;
