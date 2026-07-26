import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, test } from "node:test";
import {
  DEFAULT_PERSONA,
  LIMITS,
  normalizeSettings,
} from "../lib/settings-schema.ts";

process.env.ADMIN_PASSWORD = "correct horse battery staple";

// Dynamic: both modules read their config at module-evaluation time, so the
// env has to be set first. A static import hoists above these assignments.
const auth = await import("../lib/admin-auth.ts");

/* ------------------------------------------------------------- admin auth -- */

test("only the exact password is accepted", async () => {
  assert.equal(await auth.checkPassword("correct horse battery staple"), true);
  assert.equal(await auth.checkPassword("correct horse battery stapl"), false);
  assert.equal(await auth.checkPassword("correct horse battery staple "), false);
  assert.equal(await auth.checkPassword(""), false);
  assert.equal(await auth.checkPassword(undefined), false);
  assert.equal(await auth.checkPassword(null), false);
  assert.equal(await auth.checkPassword({}), false);
});

test("a freshly issued token verifies", async () => {
  assert.equal(await auth.verifyToken(await auth.issueToken()), true);
});

test("tampered and expired tokens are rejected", async () => {
  const token = await auth.issueToken();
  const [exp, signature] = token.split(".");

  // Signature flipped.
  const flipped = signature[0] === "a" ? "b" : "a";
  assert.equal(
    await auth.verifyToken(`${exp}.${flipped}${signature.slice(1)}`),
    false,
  );

  // Expiry pushed out without re-signing: the expiry is inside the payload,
  // so extending it invalidates the signature.
  assert.equal(
    await auth.verifyToken(`${Number(exp) + 86400}.${signature}`),
    false,
  );

  // Genuinely expired, correctly signed for its own past expiry.
  const past = Math.floor(Date.now() / 1000) - 10;
  const stale = await auth.issueToken();
  assert.equal(await auth.verifyToken(`${past}.${stale.split(".")[1]}`), false);

  assert.equal(await auth.verifyToken(""), false);
  assert.equal(await auth.verifyToken("garbage"), false);
  assert.equal(await auth.verifyToken(".abc"), false);
  assert.equal(await auth.verifyToken(undefined), false);
});

/* ---------------------------------------------------------- settings input -- */

test("settings input is validated at the trust boundary", () => {
  const good = normalizeSettings({
    model: " gemini-2.5-pro ",
    temperature: 0.8,
    persona: "  jadilah hakim  ",
    placeCheck: true,
    paused: false,
  });
  assert.deepEqual(good, {
    model: "gemini-2.5-pro",
    temperature: 0.8,
    persona: "jadilah hakim",
    placeCheck: true,
    paused: false,
  });

  // A blank persona restores the shipped prompt rather than disarming the judge.
  assert.equal(
    normalizeSettings({ model: "m", temperature: 1, persona: "   " })?.persona,
    DEFAULT_PERSONA,
  );

  assert.equal(normalizeSettings({ model: "", temperature: 1 }), null);
  assert.equal(normalizeSettings({ model: "m", temperature: 2.5 }), null);
  assert.equal(normalizeSettings({ model: "m", temperature: -1 }), null);
  assert.equal(normalizeSettings({ model: "m", temperature: "hot" }), null);
  assert.equal(normalizeSettings({ model: "m" }), null);
  assert.equal(normalizeSettings(null), null);
  assert.equal(normalizeSettings("model=m"), null);

  assert.equal(
    normalizeSettings({
      model: "m",
      temperature: 1,
      persona: "x".repeat(LIMITS.personaMax + 500),
    })?.persona.length,
    LIMITS.personaMax,
  );

  // Truthiness, not presence: an absent toggle must read as off.
  assert.equal(
    normalizeSettings({ model: "m", temperature: 1 })?.placeCheck,
    false,
  );
});

/* -------------------------------------------------------- supabase wiring -- */

let server: Server;
let received: { method: string; url: string; body: string }[] = [];

before(async () => {
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      received.push({
        method: request.method ?? "",
        url: request.url ?? "",
        body,
      });
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        request.method === "GET"
          ? JSON.stringify({
              model: "gemini-2.5-pro",
              temperature: 0.4,
              persona: "   ",
              place_check: false,
              paused: true,
            })
          : "[]",
      );
    });
  });
  const listening = Promise.withResolvers<void>();
  server.listen(0, listening.resolve);
  await listening.promise;

  const address = server.address();
  assert.ok(address && typeof address === "object", "server must have a port");
  process.env.SUPABASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
});

after(() => server.close());

test("settings are read from supabase and blanks fall back", async () => {
  const settings = await import("../lib/settings.ts");
  received = [];

  const value = await settings.getSettings();

  assert.equal(value.model, "gemini-2.5-pro");
  assert.equal(value.temperature, 0.4);
  assert.equal(value.placeCheck, false);
  assert.equal(value.paused, true);
  // Whitespace-only persona in the DB must not disarm the judge.
  assert.equal(value.persona, DEFAULT_PERSONA);

  const request = received.at(-1);
  assert.equal(request?.method, "GET");
  assert.match(request!.url, /^\/rest\/v1\/settings\?/);
  assert.match(request!.url, /id=eq\.true/);

  // Second read inside the TTL must not hit the network again.
  received = [];
  await settings.getSettings();
  assert.equal(received.length, 0);

  // Saving invalidates, so the next read goes back out.
  await settings.saveSettings({
    model: "gemini-2.5-flash",
    temperature: 1.1,
    persona: "p",
    placeCheck: true,
    paused: false,
  });
  received = [];
  await settings.getSettings();
  assert.equal(received.length, 1);
});
