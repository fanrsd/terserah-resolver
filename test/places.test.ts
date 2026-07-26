import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import { placeExists, placeIndexSize } from "../lib/judge.ts";

// The place check is the one signal the admin history presents as fact, and it
// has already shipped once as a lie: the Google version returned `true` on
// every failure, so an unreachable checker read as a pass. These tests defend
// the three states — found, absent, and could-not-check — against exactly that
// regression.
//
// Same shape as admin.test.ts: a real HTTP server standing in for PostgREST,
// no mocking library. `nn=eq.` in the query string decides the reply.

const server = createServer((request, response) => {
  const url = request.url ?? "";

  if (url.includes("boom")) {
    response.writeHead(500, { "content-type": "application/json" });
    response.end(JSON.stringify({ message: "relation does not exist" }));
    return;
  }

  const rows = url.includes("nn=eq.seirock+ya") ? [{ nn: "seirock ya" }] : [];
  response.writeHead(200, {
    "content-type": "application/json",
    // PostgREST reports an exact count here; placeIndexSize reads it.
    "content-range": "0-0/1084930",
  });
  response.end(JSON.stringify(rows));
});

before(async () => {
  const listening = Promise.withResolvers<void>();
  server.listen(0, listening.resolve);
  await listening.promise;

  const address = server.address();
  assert.ok(address && typeof address === "object", "server must have a port");
  process.env.SUPABASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
});

after(() => server.close());

test("a name in the index is found", async () => {
  assert.equal(await placeExists("Seirock-Ya"), true);
});

test("normalisation matches the shape the index is stored in", async () => {
  // The index holds `trim(regexp_replace(lower(name), '[^a-z0-9]+', ' ', 'g'))`.
  // Every one of these must reach the same key, or the lookup silently misses
  // every real place and the whole check quietly reports false.
  for (const written of [
    "SEIROCK-YA",
    "seirock ya",
    "  Seirock   Ya  ",
    "Seirock–Ya!",
    "seirock/ya",
  ]) {
    assert.equal(await placeExists(written), true, written);
  }
});

test("an invented name is absent, not an error", async () => {
  assert.equal(await placeExists("Warung Nasi Padang Zzyzx Fiktif"), false);
});

test("a broken index reads as could-not-check, never as verified", async () => {
  // The regression that motivated the rewrite: this must not be `true`, and it
  // must not be `false` either — a missing table is not evidence the place was
  // invented, and recording it as such would send the judge back for no reason.
  assert.equal(await placeExists("boom"), null);
});

test("no Supabase configured is could-not-check", async () => {
  const url = process.env.SUPABASE_URL;
  delete process.env.SUPABASE_URL;
  // supabase() memoises per isolate, so clear the cache the module reads.
  const cache = globalThis as { __terserahSupabase?: unknown };
  const saved = cache.__terserahSupabase;
  delete cache.__terserahSupabase;

  try {
    assert.equal(await placeExists("Seirock-Ya"), null);
  } finally {
    process.env.SUPABASE_URL = url;
    cache.__terserahSupabase = saved;
  }
});

test("index size is read from the count header", async () => {
  assert.equal(await placeIndexSize(), 1_084_930);
});
