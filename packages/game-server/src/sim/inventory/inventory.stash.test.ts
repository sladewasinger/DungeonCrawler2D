import { TILE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { doStash, invAdd, invIndex, invQty } from "./inventory.js";
import { buildSim, buildSlot, fakeWorld } from "./inventory.testSupport.js";

describe("inventory: stash", () => {
  it("puts a stack into the stash and takes it back out", () => {
    const sim = buildSim(fakeWorld({ x: 0, y: 0, tile: TILE.Stash }));
    const slot = buildSlot(0, 1);
    invAdd(sim, slot, "rag", 4);
    doStash(sim, slot, { op: "put", index: invIndex(slot, "rag") });
    expect(invQty(slot, "rag")).toBe(0);
    expect(slot.stored.stash).toEqual([{ item: "rag", qty: 4 }]);
    expect(slot.outbox.at(-1)).toEqual({ t: "stash", slots: [{ item: "rag", qty: 4 }] });
    doStash(sim, slot, { op: "take", index: 0 });
    expect(invQty(slot, "rag")).toBe(4);
    expect(slot.stored.stash).toEqual([]);
  });

  it("clears the weapon slot when the equipped weapon is stashed", () => {
    const sim = buildSim(fakeWorld({ x: 0, y: 0, tile: TILE.Stash }));
    const slot = buildSlot(0, 1);
    invAdd(sim, slot, "sword", 1);
    doStash(sim, slot, { op: "put", index: invIndex(slot, "sword") });
    expect(slot.weapon).toBeNull();
  });

  it("does nothing when not adjacent to a stash tile", () => {
    const sim = buildSim(fakeWorld());
    const slot = buildSlot(0, 1);
    invAdd(sim, slot, "rag", 1);
    doStash(sim, slot, { op: "put", index: invIndex(slot, "rag") });
    expect(invQty(slot, "rag")).toBe(1);
    expect(slot.outbox).toEqual([]);
  });
});
