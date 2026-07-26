import { readFile } from "node:fs/promises";

/**
 * Bulk-loads the place index into Supabase.
 *
 *   node --env-file=.env.local scripts/load-places.mjs places.txt
 *
 * One normalised name per line, produced by the DuckDB query in
 * supabase/migrations/0003_places.sql. Run that migration first — this script
 * only inserts rows, it cannot create the table.
 *
 * PostgREST is the only write path we have: the service-role key authenticates
 * against the REST API, not Postgres, so there is no COPY and no psql. Batches
 * of 5,000 keep each request near 200 KB, which is well inside the gateway's
 * limit and still turns 1.08M rows into ~217 calls rather than 1.08M.
 *
 * Restartable by construction: `resolution=ignore-duplicates` makes a re-run
 * skip what is already stored instead of failing the batch on the first
 * primary-key clash, so an interrupted load is fixed by running it again.
 */

const BATCH = 5_000;
const LANES = 4;
const RETRIES = 3;

const [file] = process.argv.slice(2);
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!file || !url || !key) {
  console.error(
    "usage: node --env-file=.env.local scripts/load-places.mjs <names.txt>\n" +
      "needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment",
  );
  process.exit(1);
}

async function push(rows) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(`${url}/rest/v1/places`, {
        method: "POST",
        headers: {
          apikey: key,
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
          prefer: "resolution=ignore-duplicates,return=minimal",
        },
        body: JSON.stringify(rows),
      });
      if (response.ok) return;
      // 4xx is a bad payload and will fail identically next time; only a 5xx
      // or a dropped socket is worth another attempt.
      const body = (await response.text()).slice(0, 300);
      if (response.status < 500 || attempt > RETRIES) {
        throw new Error(`${response.status} ${body}`);
      }
    } catch (error) {
      if (attempt > RETRIES) throw error;
    }
    await new Promise((r) => setTimeout(r, 500 * attempt));
  }
}

const names = (await readFile(file, "utf8"))
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

const batches = [];
for (let i = 0; i < names.length; i += BATCH) {
  batches.push(names.slice(i, i + BATCH).map((nn) => ({ nn })));
}

console.log(
  `${names.length.toLocaleString()} names, ${batches.length} batches, ${LANES} lanes`,
);

const started = Date.now();
let next = 0;
let done = 0;

await Promise.all(
  Array.from({ length: LANES }, async () => {
    while (next < batches.length) {
      const index = next++;
      await push(batches[index]);
      done++;
      if (done % 20 === 0 || done === batches.length) {
        const secs = (Date.now() - started) / 1000;
        console.log(
          `  ${done}/${batches.length} batches  ${secs.toFixed(0)}s`,
        );
      }
    }
  }),
);

const response = await fetch(`${url}/rest/v1/places?select=nn`, {
  method: "HEAD",
  headers: {
    apikey: key,
    authorization: `Bearer ${key}`,
    prefer: "count=exact",
    range: "0-0",
  },
});
const total = response.headers.get("content-range")?.split("/").pop();
console.log(`loaded in ${((Date.now() - started) / 1000).toFixed(0)}s — table now holds ${total} rows`);
