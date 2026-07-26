import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import * as auth from "../lib/admin-auth.ts";
import * as secret from "../lib/secret.ts";
import * as settings from "../lib/settings.ts";
import {
  completionsUrl,
  DEFAULT_PERSONA,
  LIMITS,
  normalizeSettings,
  readApiKey,
} from "../lib/settings-schema.ts";

// Every module under test reads env inside its functions, not at module scope
// (a Cloudflare Workers requirement), so plain static imports are enough and
// the env can be set in a hook.

let received: { method: string; url: string; body: string }[] = [];

const server = createServer((request, response) => {
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
            provider: "gemini",
            base_url: "",
            model: "gemini-2.5-pro",
            temperature: 0.4,
            persona: "   ",
            place_check: false,
            paused: true,
            api_key_cipher: null,
          })
        : "[]",
    );
  });
});

before(async () => {
  process.env.ADMIN_PASSWORD = "correct horse battery staple";
  process.env.SETTINGS_ENCRYPTION_KEY = "a-master-key-long-enough";

  const listening = Promise.withResolvers<void>();
  server.listen(0, listening.resolve);
  await listening.promise;

  const address = server.address();
  assert.ok(address && typeof address === "object", "server must have a port");
  process.env.SUPABASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
});

after(() => server.close());

/* ------------------------------------------------------------- admin auth -- */

test("only the exact password is accepted", async () => {
  assert.equal(await auth.checkPassword("correct horse battery staple"), true);
  assert.equal(await auth.checkPassword("correct horse battery stapl"), false);
  assert.equal(
    await auth.checkPassword("correct horse battery staple "),
    false,
  );
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

  const flipped = signature[0] === "a" ? "b" : "a";
  assert.equal(
    await auth.verifyToken(`${exp}.${flipped}${signature.slice(1)}`),
    false,
  );

  // The expiry is inside the signed payload, so extending it breaks the mac.
  assert.equal(
    await auth.verifyToken(`${Number(exp) + 86400}.${signature}`),
    false,
  );

  // Genuinely expired, correctly signed for its own past expiry.
  const past = Math.floor(Date.now() / 1000) - 10;
  assert.equal(await auth.verifyToken(`${past}.${signature}`), false);

  assert.equal(await auth.verifyToken(""), false);
  assert.equal(await auth.verifyToken("garbage"), false);
  assert.equal(await auth.verifyToken(".abc"), false);
  assert.equal(await auth.verifyToken(undefined), false);
});

/* ---------------------------------------------------------- settings input -- */

test("settings input is validated at the trust boundary", () => {
  assert.deepEqual(
    normalizeSettings({
      model: " gemini-2.5-pro ",
      temperature: 0.8,
      persona: "  jadilah hakim  ",
      placeCheck: true,
      paused: false,
    }),
    {
      provider: "gemini",
      baseUrl: "",
      model: "gemini-2.5-pro",
      temperature: 0.8,
      persona: "jadilah hakim",
      placeCheck: true,
      paused: false,
    },
  );

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

/* ------------------------------------------------------- custom endpoints -- */

test("a custom endpoint must carry a usable base URL", () => {
  const good = normalizeSettings({
    provider: "openai",
    baseUrl: " https://openrouter.ai/api/v1 ",
    model: "google/gemini-2.5-flash",
    temperature: 1,
    persona: "p",
  });
  assert.equal(good?.provider, "openai");
  assert.equal(good?.baseUrl, "https://openrouter.ai/api/v1");

  // Accepting these would mean every case quietly falls back instead.
  const bad = { provider: "openai", model: "m", temperature: 1 };
  assert.equal(normalizeSettings({ ...bad, baseUrl: "" }), null);
  assert.equal(normalizeSettings({ ...bad, baseUrl: "openrouter.ai/v1" }), null);
  assert.equal(normalizeSettings({ ...bad, baseUrl: "ftp://host/v1" }), null);
  assert.equal(normalizeSettings({ ...bad, baseUrl: "not a url" }), null);

  // A blank base URL is fine when the provider doesn't use one, and anything
  // that isn't "openai" falls back to the native provider.
  assert.equal(
    normalizeSettings({ provider: "gemini", baseUrl: "", model: "m", temperature: 1 })
      ?.provider,
    "gemini",
  );
  assert.equal(
    normalizeSettings({ provider: "anthropic", model: "m", temperature: 1 })
      ?.provider,
    "gemini",
  );
});

test("base URLs normalize to the completions path either way", () => {
  const want = "https://api.openai.com/v1/chat/completions";
  assert.equal(completionsUrl("https://api.openai.com/v1"), want);
  assert.equal(completionsUrl("https://api.openai.com/v1/"), want);
  assert.equal(completionsUrl("https://api.openai.com/v1///"), want);
  assert.equal(completionsUrl("  https://api.openai.com/v1  "), want);
  assert.equal(completionsUrl(want), want);
  assert.equal(
    completionsUrl("http://localhost:11434/v1"),
    "http://localhost:11434/v1/chat/completions",
  );
});

test("api key input is three-state so an edit cannot wipe the key", () => {
  assert.equal(readApiKey({ apiKey: "sk-live" }), "sk-live");
  assert.equal(readApiKey({ apiKey: "  sk-live  " }), "sk-live");
  assert.equal(readApiKey({ apiKey: null }), null); // explicit clear
  assert.equal(readApiKey({ apiKey: "" }), undefined); // blank = leave alone
  assert.equal(readApiKey({ apiKey: "   " }), undefined);
  assert.equal(readApiKey({}), undefined); // absent = leave alone
  assert.equal(readApiKey({ apiKey: 42 }), undefined);
  assert.equal(readApiKey(null), undefined);
});

test("stored keys round-trip and reject tampering", async () => {
  assert.equal(secret.canStoreSecrets(), true);

  const cipher = await secret.encryptSecret("sk-super-secret");
  assert.ok(cipher);
  assert.equal(cipher.includes("sk-super-secret"), false);
  assert.equal(await secret.decryptSecret(cipher), "sk-super-secret");

  // A fresh IV per call, so identical plaintext never yields identical blobs.
  assert.notEqual(await secret.encryptSecret("sk-super-secret"), cipher);

  // Tampered, truncated, and junk blobs return null instead of throwing.
  const flipped = cipher[20] === "A" ? "B" : "A";
  assert.equal(
    await secret.decryptSecret(cipher.slice(0, 20) + flipped + cipher.slice(21)),
    null,
  );
  assert.equal(await secret.decryptSecret(cipher.slice(0, 8)), null);
  assert.equal(await secret.decryptSecret("not base64 at all!!"), null);
  assert.equal(await secret.decryptSecret(null), null);
  assert.equal(await secret.encryptSecret(""), null);
});

/* -------------------------------------------------------- supabase wiring -- */

test("settings are read from supabase and blanks fall back", async () => {
  received = [];

  const value = await settings.getSettings();

  assert.equal(value.model, "gemini-2.5-pro");
  assert.equal(value.temperature, 0.4);
  assert.equal(value.placeCheck, false);
  assert.equal(value.paused, true);
  // Whitespace-only persona in the DB must not disarm the judge.
  assert.equal(value.persona, DEFAULT_PERSONA);
  // The stored cipher must never ride along to a caller that may serialize it.
  assert.equal("apiKeyCipher" in value, false);

  const request = received.at(-1);
  assert.equal(request?.method, "GET");
  assert.match(request!.url, /^\/rest\/v1\/settings\?/);
  assert.match(request!.url, /id=eq\.true/);

  // Second read inside the TTL must not hit the network again.
  received = [];
  await settings.getSettings();
  assert.equal(received.length, 0);
});

test("saving encrypts the key, invalidates, and honours the three states", async () => {
  const base = {
    provider: "openai" as const,
    baseUrl: "https://openrouter.ai/api/v1",
    model: "google/gemini-2.5-flash",
    temperature: 1.1,
    persona: "p",
    placeCheck: true,
    paused: false,
  };

  received = [];
  assert.equal(await settings.saveSettings(base, "sk-plaintext"), true);
  const written = received.at(-1)?.body ?? "";
  assert.equal(written.includes("sk-plaintext"), false, "key must be encrypted");
  assert.match(written, /api_key_cipher/);

  // Saving invalidates the cache, so the next read goes back out.
  received = [];
  await settings.getSettings();
  assert.equal(received.length, 1);

  // Omitted key: the column must not appear at all, or an unrelated edit
  // would silently wipe the stored key.
  received = [];
  await settings.saveSettings(base);
  assert.equal(received.at(-1)?.body.includes("api_key_cipher"), false);

  // Explicit null clears it.
  received = [];
  await settings.saveSettings(base, null);
  assert.match(received.at(-1)?.body ?? "", /"api_key_cipher":null/);
});
