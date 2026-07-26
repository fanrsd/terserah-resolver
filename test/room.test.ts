import assert from "node:assert/strict";
import { test } from "node:test";
import { parseVerdict } from "../lib/judge.ts";
import {
  accept,
  cleanDealbreakers,
  cleanLine,
  createRoom,
  decide,
  isRoomId,
  newRoomId,
  protest,
  type Verdict,
} from "../lib/room.ts";

const VERDICT: Verdict = {
  place: "RAMEN YA",
  mapsQuery: "Ramen Ya, Tangerang",
  reasoning: "Kalian sama-sama ribet.",
};

test("a fresh room waits for B", () => {
  const room = createRoom("Warkop depan gang", "Tangerang");
  assert.equal(room.state, "awaiting_b");
  assert.ok(isRoomId(room.id));
});

test("accept and protest both leave awaiting_b exactly once", () => {
  const room = createRoom("Warkop", "Tangerang");

  assert.equal(accept(room).state, "accepted");

  const protested = protest(room, ["gak panas", "gak rame", "berkuah"]);
  assert.equal(protested.state, "protested");
  assert.deepEqual(protested.bDealbreakers, [
    "gak panas",
    "gak rame",
    "berkuah",
  ]);

  // Second responder loses: the room already left awaiting_b.
  assert.equal(accept(protested).state, "protested");
  assert.equal(protest(accept(room), ["a", "b", "c"]).state, "accepted");
});

test("decided is terminal so a retry cannot buy a second model call", () => {
  const room = decide(
    protest(createRoom("Warkop", "Tangerang"), ["a", "b", "c"]),
    VERDICT,
  );
  const overwrite = decide(room, { ...VERDICT, place: "SOMETHING ELSE" });

  assert.equal(room.state, "decided");
  assert.equal(overwrite.verdict?.place, "RAMEN YA");
});

test("room ids use the unambiguous alphabet", () => {
  for (let i = 0; i < 500; i++) {
    const id = newRoomId();
    assert.equal(id.length, 6);
    assert.ok(isRoomId(id), `${id} should be a valid id`);
    assert.doesNotMatch(id, /[01lo]/, `${id} contains a lookalike character`);
  }
  assert.equal(isRoomId("ABC123"), false);
  assert.equal(isRoomId("abc12"), false);
});

test("input cleaning collapses whitespace and clamps length", () => {
  assert.equal(cleanLine("  nasi   padang \n", 80), "nasi padang");
  assert.equal(cleanLine("x".repeat(200), 80).length, 80);
  assert.equal(cleanLine(undefined, 80), "");
  assert.equal(cleanLine(42, 80), "");
});

test("dealbreakers must be exactly three non-empty lines", () => {
  assert.deepEqual(cleanDealbreakers(["a", "b", "c"]), ["a", "b", "c"]);
  assert.equal(cleanDealbreakers(["a", "b"]), null);
  assert.equal(cleanDealbreakers(["a", "  ", "c"]), null);
  assert.equal(cleanDealbreakers(["a", "b", "c", "d"]), null);
  assert.equal(cleanDealbreakers("a,b,c"), null);
  assert.equal(cleanDealbreakers(null), null);
});

test("verdict parser rejects malformed model output", () => {
  const good = parseVerdict(
    '{"place":"ramen ya","maps_query":"Ramen Ya, Tangerang","reasoning":"Ribet."}',
  );
  assert.equal(good.place, "RAMEN YA");
  assert.equal(good.mapsQuery, "Ramen Ya, Tangerang");

  // Missing maps_query is survivable: fall back to the place name.
  assert.equal(
    parseVerdict('{"place":"Sate Senayan","reasoning":"Ribet."}').mapsQuery,
    "Sate Senayan",
  );

  assert.throws(() => parseVerdict("not json"));
  assert.throws(() => parseVerdict(undefined));
  assert.throws(() => parseVerdict('{"place":"","reasoning":"x"}'));
  assert.throws(() => parseVerdict('{"place":"Warung","reasoning":"   "}'));
});
