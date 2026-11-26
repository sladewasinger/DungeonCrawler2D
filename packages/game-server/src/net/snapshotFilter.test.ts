import type { PlayerSnapshot, WorldChestSnapshot } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { filterSnapshotForPlayer, inventorySignature } from "./snapshotFilter.js";

const POI_BANDIT_CAMP = "bandit-camp";
const CHEST_UNOPENED_ID = "c-unopened";
const CHEST_SEALED_ID = "c-sealed";
const CHEST_OPENED_ID = "c-opened";

function makePlayer(overrides: Partial<PlayerSnapshot> & { readonly id: string }): PlayerSnapshot {
  return {
    name: "Traveler", x: 0, y: 0, elevation: 0, facingX: 1, facingY: 0,
    moving: false, torchLit: false, inWater: false, lastAckSeq: 1, ...overrides,
  };
}

function makeChest(overrides: Partial<WorldChestSnapshot> & { readonly id: string }): WorldChestSnapshot {
  return { poiKind: POI_BANDIT_CAMP, x: 5, y: 0, elevation: 0, opened: false, slots: [], ...overrides };
}

describe("snapshotFilter", () => {
  it("culls distant entities, chests, groundLoot, events, and webs outside the client AOI", () => {
    const filtered = filterSnapshotForPlayer({
      playerId: "p1",
      aoiRadiusTiles: 40,
      data: {
        players: [makePlayer({ id: "p1", name: "Hero", x: 10.12345, y: -5.6789 })],
        entities: [
          { id: "e-near", kind: "wolf", x: 25, y: 0, elevation: 0, facingX: 1, facingY: 0, hp: 20, maxHp: 20, hitTimer: 0, staggerTimer: 0, bleedTimer: 0, telegraphProgress: 0, substance: "blood" },
          { id: "e-far", kind: "wolf", x: 120, y: 0, elevation: 0, facingX: 1, facingY: 0, hp: 20, maxHp: 20, hitTimer: 0, staggerTimer: 0, bleedTimer: 0, telegraphProgress: 0, substance: "blood" },
        ],
        projectiles: [],
        chests: [makeChest({ id: "c-near", x: 20 }), makeChest({ id: "c-far", x: -90 })],
        groundLoot: [
          { id: "l-near", itemId: "stone", count: 1, x: 12, y: -4, elevation: 0, ageSec: 0 },
          { id: "l-far", itemId: "stone", count: 1, x: 85, y: 85, elevation: 0, ageSec: 0 },
        ],
        events: [{ kind: "hit", x: 15, y: -3 }, { kind: "hit", x: -80, y: -80 }],
        webs: {
          nodes: [{ id: 1, x: 12, y: -4, pinned: false }, { id: 2, x: 14, y: -4, pinned: false }, { id: 3, x: 95, y: 95, pinned: false }, { id: 4, x: 97, y: 95, pinned: false }],
          strands: [{ a: 1, b: 2 }, { a: 3, b: 4 }],
        },
      },
    });
    expect(filtered.players[0]?.x).toBe(10.123);
    expect(filtered.entities.map((e) => e.id)).toEqual(["e-near"]);
    expect(filtered.chests.map((c) => c.id)).toEqual(["c-near"]);
    expect(filtered.groundLoot.map((g) => g.id)).toEqual(["l-near"]);
    expect(filtered.events).toHaveLength(1);
    expect(filtered.webs?.nodes.map((n) => n.id)).toEqual([1, 2]);
    expect(filtered.webs?.strands).toEqual([{ a: 1, b: 2 }]);
  });

  it("culls stealthed players and strips remote private stats", () => {
    const filtered = filterSnapshotForPlayer({
      playerId: "p1",
      aoiRadiusTiles: 40,
      data: {
        players: [
          makePlayer({ id: "p1", name: "Self", stamina: 75, maxStamina: 100, godMode: true }),
          makePlayer({ id: "p-visible", name: "Visible", x: 10, lastAckSeq: 2, stamina: 40, maxStamina: 100, wellFedTimer: 90, hasBedRespawn: true, godMode: true }),
          makePlayer({ id: "p-stealth", name: "Sneak", x: 25, lastAckSeq: 3, crouching: true, stealthVis: 0.25 }),
        ],
        entities: [], projectiles: [], chests: [], groundLoot: [], events: [],
      },
    });
    expect(filtered.players.map((p) => p.id)).toEqual(["p1", "p-visible"]);
    expect(filtered.players[0]?.stamina).toBe(75);
    const remote = filtered.players[1];
    expect(remote?.stamina).toBeUndefined();
    expect(remote?.wellFedTimer).toBeUndefined();
    expect(remote?.hasBedRespawn).toBeUndefined();
    expect(remote?.godMode).toBeUndefined();
  });

  it("redacts unopened or sealed chest slots while preserving opened unsealed chests", () => {
    const filtered = filterSnapshotForPlayer({
      playerId: "p1",
      aoiRadiusTiles: 40,
      data: {
        players: [makePlayer({ id: "p1", name: "Self" })],
        entities: [], projectiles: [], groundLoot: [], events: [],
        chests: [
          makeChest({ id: CHEST_UNOPENED_ID, slots: [{ itemId: "ruby", count: 1 }] }),
          makeChest({ id: CHEST_SEALED_ID, x: 6, opened: true, sealed: true, slots: [{ itemId: "ancient-core", count: 1 }] }),
          makeChest({ id: CHEST_OPENED_ID, x: 7, opened: true, sealed: false, slots: [{ itemId: "wood", count: 2 }] }),
        ],
      },
    });
    const unopened = filtered.chests.find((c) => c.id === CHEST_UNOPENED_ID);
    const sealed = filtered.chests.find((c) => c.id === CHEST_SEALED_ID);
    const opened = filtered.chests.find((c) => c.id === CHEST_OPENED_ID);
    expect(unopened?.slots).toHaveLength(27);
    expect(unopened?.slots.every((s) => s === null)).toBe(true);
    expect(sealed?.slots.every((s) => s === null)).toBe(true);
    expect(opened?.slots).toEqual([{ itemId: "wood", count: 2 }]);
  });

  it("produces distinct signatures when inventory state changes", () => {
    const base = { slots: [{ itemId: "sword", count: 1 }], selectedHotbar: 0, armor: { head: null, chest: null, legs: null, feet: null, offhand: null }, nearCampfire: false, ackSeq: 1 };
    expect(inventorySignature(base)).toBe(inventorySignature({ ...base }));
    expect(inventorySignature(base)).not.toBe(inventorySignature({ ...base, nearCampfire: true }));
  });
});
