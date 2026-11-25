import { describe, expect, it } from "vitest";
import { filterSnapshotForPlayer, inventorySignature } from "./snapshotFilter.js";

describe("snapshotFilter", () => {
  it("culls distant entities, chests, groundLoot, events, and webs outside the client AOI", () => {
    const filtered = filterSnapshotForPlayer({
      playerId: "p1",
      aoiRadiusTiles: 40,
      data: {
        players: [{ id: "p1", name: "Hero", x: 10.12345, y: -5.6789, elevation: 0, facingX: 1, facingY: 0, moving: false, torchLit: false, inWater: false, lastAckSeq: 1 }],
        entities: [
          { id: "e-near", kind: "wolf", x: 25, y: 0, elevation: 0, facingX: 1, facingY: 0, hp: 20, maxHp: 20, hitTimer: 0, staggerTimer: 0, bleedTimer: 0, telegraphProgress: 0, substance: "blood" },
          { id: "e-far", kind: "wolf", x: 120, y: 0, elevation: 0, facingX: 1, facingY: 0, hp: 20, maxHp: 20, hitTimer: 0, staggerTimer: 0, bleedTimer: 0, telegraphProgress: 0, substance: "blood" },
        ],
        projectiles: [],
        chests: [
          { id: "c-near", poiKind: "bandit-camp", x: 20, y: 0, elevation: 0, opened: false, slots: [] },
          { id: "c-far", poiKind: "bandit-camp", x: -90, y: 0, elevation: 0, opened: false, slots: [] },
        ],
        groundLoot: [
          { id: "l-near", itemId: "stone", count: 1, x: 12, y: -4, elevation: 0, ageSec: 0 },
          { id: "l-far", itemId: "stone", count: 1, x: 85, y: 85, elevation: 0, ageSec: 0 },
        ],
        events: [
          { kind: "hit", x: 15, y: -3 },
          { kind: "hit", x: -80, y: -80 },
        ],
        webs: {
          nodes: [
            { id: 1, x: 12, y: -4, pinned: false },
            { id: 2, x: 14, y: -4, pinned: false },
            { id: 3, x: 95, y: 95, pinned: false },
            { id: 4, x: 97, y: 95, pinned: false },
          ],
          strands: [
            { a: 1, b: 2 },
            { a: 3, b: 4 },
          ],
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

  it("produces distinct signatures when inventory state changes", () => {
    const base = { slots: [{ itemId: "sword", count: 1 }], selectedHotbar: 0, armor: { head: null, chest: null, legs: null, feet: null, offhand: null }, nearCampfire: false, ackSeq: 1 };
    expect(inventorySignature(base)).toBe(inventorySignature({ ...base }));
    expect(inventorySignature(base)).not.toBe(inventorySignature({ ...base, nearCampfire: true }));
  });
});
