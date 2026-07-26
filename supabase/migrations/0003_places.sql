-- The judge names a restaurant; this table is how we find out whether it is a
-- real one.
--
-- Google Places answered the same question for free (Text Search Essentials,
-- IDs Only, SKU 635D-A9DD-C520 — the one Essentials SKU with no monthly cap),
-- but getting a key requires a billing-enabled Cloud project. That card was
-- never added, so `GOOGLE_PLACES_API_KEY` stayed empty, `judge.ts` short-
-- circuited the check to false on every request, and `place_verified` was null
-- on every decided case while the admin panel showed the toggle as ON.
--
-- Foursquare Open Source Places (Apache 2.0, 100M+ POIs) answers it from our
-- own Postgres instead: no key, no card, no vendor, no per-verdict round trip
-- to anyone. Measured against four real Jakarta places and five invented ones,
-- exact-normalised lookup got 3/4 and 0/5. OSM was tried first and is not
-- close: Nominatim found 1/4 and rejected Seirock-Ya, a real restaurant in
-- Blok M; Photon matched "Kopi 88 Bintaro" to a different café entirely.
--
-- 8,313,900 Indonesian POIs reduce to 1,084,930 distinct normalised food
-- names. Regenerate with DuckDB against the public mirror (parts 56-75 of the
-- 2025-02-06 snapshot are the ones whose parquet footers overlap Indonesia):
--
--   install httpfs; load httpfs;
--   copy (
--     select distinct trim(regexp_replace(lower(name), '[^a-z0-9]+', ' ', 'g')) nn
--     from read_parquet([
--       'https://data.source.coop/fused/fsq-os-places/2025-02-06/places/56.parquet',
--       ...  -- 57-61, 63-66, 69-72, 74, 75
--     ])
--     where country = 'ID' and date_closed is null and name is not null
--       and (list_aggregate(fsq_category_labels, 'string_agg', ' ') like 'Dining and Drinking%'
--            or (fsq_category_labels is null and regexp_matches(nn,
--                '(warung|warteg|kedai|nasi|ayam|bakso|sate|soto|mie|bakmi|kopi'
--                '|cafe|kafe|resto|padang|martabak|angkringan|pecel|gudeg|seafood'
--                '|steak|sushi|ramen|pizza|burger|bakery|roti|jus|depot|rumah makan|food)')))
--       and length(nn) >= 4
--   ) to 'places.txt';
--
-- Then `node scripts/load-places.mjs places.txt`.
--
-- Uncategorised rows are included when the name itself reads like food: 341,400
-- distinct names have no FSQ category but are plainly warungs, and dropping
-- them would repeat Nominatim's mistake of rejecting real places.
--
-- Names only. The question is existence, and `cases.verdict_place` already
-- records what was asked. `nn` as the primary key makes the lookup one index
-- probe and the loader idempotent.

create table if not exists public.places (
  nn text primary key
);

alter table public.places enable row level security;
