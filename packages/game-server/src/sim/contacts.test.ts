import {
  LEVEL,
  World,
  buildContentRegistry,
  createBody,
  hashString,
  makeEntity,
  newEntityId,
  type RawContent,
} from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { PlayerStore } from "../store.js";
import { doFistbump, doWho, expireFistbumpOffers, withinRateLimit } from "./contacts.js";
import { createSimState, type PlayerSlot, type SimState } from "./state.js";

/** Unit tests for fistbump mutual-contact handshake, /who, and the shared rate-limit helper. */

const EMPTY_CONTENT: RawContent = { statuses: [], rules: [], areas: [], items: [], enemies: [], recipes: [] };

function makeSlot(name: string, x: number, y: number): PlayerSlot {
  const entity = makeEntity("player", createBody(x, y, 0), {
    id: newEntityId("p"),
    name,
    hp: 10,
    maxHp: 10,
    tags: new Set(["player"]),
  });
  return {
    entity,
    clientId: `client-${name}`,
    stored: { slot: 0, name, stash: [], contacts: [] },
    resumeToken: `token-${name}`,
    lastSeq: -1,
    pendingInputs: [],
    pendingActions: [],
    connected: true,
    reapAtTick: Number.MAX_SAFE_INTEGER,
    known: new Set(),
    inventory: [],
    hotbar: [],
    weapon: null,
    outbox: [],
    returnStack: [],
    partyId: null,
    respawnAtTick: null,
    needsFullAreas: true,
    downedAtTick: null,
    attackReadyAtTick: 0,
    attackStartedAtTick: Number.NEGATIVE_INFINITY,
    god: false,
    forceDeath: false,
    chatTimestamps: [],
    lastFistbumpOfferAtTick: -Infinity, spawnGraceUntilTick: 0, pendingTransfer: null,
  };
}

describe("contacts", () => {
  let sim: SimState;
  let a: PlayerSlot;
  let b: PlayerSlot;

  beforeEach(() => {
    const world = new World(hashString("contacts-test"), 1, LEVEL.Sandbox);
    const content = buildContentRegistry(EMPTY_CONTENT);
    sim = createSimState(world, content, new PlayerStore(null), 1, {});
    a = makeSlot("A", 10, 10);
    b = makeSlot("B", 11, 10);
    sim.players.set(a.entity.id, a);
    sim.players.set(b.entity.id, b);
  });

  it("a lone hold records a pending offer, not a contact", () => {
    doFistbump(sim, a, b.entity.id);
    expect(sim.fistbumpOffers.get(b.entity.id)?.from).toBe(a.entity.id);
    expect(a.stored.contacts).toEqual([]);
    expect(b.outbox.some((e) => e.t === "chat" && e.text.includes("offers a fistbump"))).toBe(true);
  });

  it("a reciprocal hold within the window seals a mutual contact for both", () => {
    doFistbump(sim, a, b.entity.id);
    doFistbump(sim, b, a.entity.id);
    expect(a.stored.contacts).toEqual(["B"]);
    expect(b.stored.contacts).toEqual(["A"]);
    expect(sim.fistbumpOffers.has(b.entity.id)).toBe(false);
    expect(a.outbox.some((e) => e.t === "contactsUpdated")).toBe(true);
    expect(b.outbox.some((e) => e.t === "contactsUpdated")).toBe(true);
  });

  it("rejects an offer beyond fistbump range", () => {
    b.entity.body.x = a.entity.body.x + 10;
    doFistbump(sim, a, b.entity.id);
    expect(sim.fistbumpOffers.has(b.entity.id)).toBe(false);
  });

  it("re-checks proximity at accept time — walking away voids a live offer", () => {
    doFistbump(sim, a, b.entity.id);
    // A wanders off while the offer is still within its TTL window.
    a.entity.body.x += 10;
    doFistbump(sim, b, a.entity.id);
    expect(a.stored.contacts).toEqual([]);
    expect(b.stored.contacts).toEqual([]);
  });

  it("throttles /who through the shared chat budget", () => {
    for (let i = 0; i < 5; i++) doWho(sim, a);
    a.outbox.length = 0;
    doWho(sim, a);
    expect(a.outbox.filter((e) => e.t === "chat")).toHaveLength(1);
    expect(a.outbox.some((e) => e.t === "chat" && e.text.includes("too fast"))).toBe(true);
  });

  it("expireFistbumpOffers drops a stale pending offer", () => {
    doFistbump(sim, a, b.entity.id);
    sim.tickCount = sim.fistbumpOffers.get(b.entity.id)!.expiresAtTick + 1;
    expireFistbumpOffers(sim);
    expect(sim.fistbumpOffers.has(b.entity.id)).toBe(false);
    // A stale offer no longer seals — the late reciprocal hold is a fresh offer instead.
    doFistbump(sim, b, a.entity.id);
    expect(a.stored.contacts).toEqual([]);
  });

  it("throttles repeat offers within the cooldown window", () => {
    doFistbump(sim, a, b.entity.id);
    a.outbox.length = 0;
    doFistbump(sim, a, b.entity.id);
    expect(a.outbox.some((e) => e.t === "chat" && e.text.includes("wait a moment"))).toBe(true);
  });

  it("/who reports online count, nearby count, and sorted names with floor (Epic 7.14)", () => {
    doWho(sim, a);
    const line = a.outbox.find((e) => e.t === "chat" && e.channel === "system");
    expect(line).toMatchObject({
      text: expect.stringContaining("Online (2, 1 nearby): A (F1), B (F1)"),
    });
  });

  it("withinRateLimit prunes the window and enforces the cap", () => {
    const stamps: number[] = [];
    expect(withinRateLimit(stamps, 0, 100, 2)).toBe(true);
    expect(withinRateLimit(stamps, 1, 100, 2)).toBe(true);
    expect(withinRateLimit(stamps, 2, 100, 2)).toBe(false);
    expect(withinRateLimit(stamps, 500, 100, 2)).toBe(true);
  });
});
