/** Property-based item conservation & stack-bound invariants for 36-slot inventories. */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { maxStackForItem } from "@dc2d/content";
import {
  TOTAL_INVENTORY_SLOTS, consumeItemFromSlots, createEmptyInventoryState,
  insertIntoSlots, moveOrSwapSlot, removeFromSlot, type InventorySlot, type PlayerInventoryState,
} from "@dc2d/engine";

const TEST_ITEMS = ["wood", "stone", "herb", "sword", "wooden-shield"] as const;

type InvOp =
  | { readonly kind: "add"; readonly item: string; readonly count: number }
  | { readonly kind: "move"; readonly from: number; readonly to: number }
  | { readonly kind: "remove"; readonly slot: number; readonly count: number }
  | { readonly kind: "consume"; readonly item: string; readonly count: number };

const opArb: fc.Arbitrary<InvOp> = fc.oneof(
  fc.record({ kind: fc.constant("add" as const), item: fc.constantFrom(...TEST_ITEMS), count: fc.integer({ min: 1, max: 12 }) }),
  fc.record({ kind: fc.constant("move" as const), from: fc.integer({ min: 0, max: 35 }), to: fc.integer({ min: 0, max: 35 }) }),
  fc.record({ kind: fc.constant("remove" as const), slot: fc.integer({ min: 0, max: 35 }), count: fc.integer({ min: 1, max: 5 }) }),
  fc.record({ kind: fc.constant("consume" as const), item: fc.constantFrom(...TEST_ITEMS), count: fc.integer({ min: 1, max: 4 }) }),
);

function tallyItems(slots: readonly InventorySlot[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const s of slots) {
    if (s) counts.set(s.itemId, (counts.get(s.itemId) ?? 0) + s.count);
  }
  return counts;
}

function applyInvOp(state: PlayerInventoryState, op: InvOp, adjust: (id: string, delta: number) => void): void {
  if (op.kind === "add") {
    adjust(op.item, insertIntoSlots(state.slots, { itemId: op.item, count: op.count }, maxStackForItem));
    return;
  }
  if (op.kind === "move") {
    moveOrSwapSlot(state.slots, { from: op.from, to: op.to }, maxStackForItem);
    return;
  }
  if (op.kind === "remove") {
    const removed = removeFromSlot(state.slots, op.slot, op.count);
    if (removed) adjust(removed.itemId, -removed.count);
    return;
  }
  if (consumeItemFromSlots(state.slots, op.item, op.count)) adjust(op.item, -op.count);
}

function assertSlotsValid(slots: readonly InventorySlot[], expectedTotals: Map<string, number>): void {
  expect(slots).toHaveLength(TOTAL_INVENTORY_SLOTS);
  for (const slot of slots) {
    if (!slot) continue;
    expect(Number.isInteger(slot.count) && slot.count >= 1).toBe(true);
    expect(slot.count).toBeLessThanOrEqual(maxStackForItem(slot.itemId));
  }
  const actual = tallyItems(slots);
  for (const id of TEST_ITEMS) expect(actual.get(id) ?? 0).toBe(expectedTotals.get(id) ?? 0);
}

describe("inventory conservation properties", () => {
  it("strictly conserves item totals and maxStack bounds across random operations", () => {
    fc.assert(
      fc.property(fc.array(opArb, { minLength: 5, maxLength: 40 }), (ops) => {
        const state = createEmptyInventoryState();
        const expectedTotals = new Map<string, number>();
        const adjust = (id: string, delta: number) => expectedTotals.set(id, (expectedTotals.get(id) ?? 0) + delta);
        for (const op of ops) applyInvOp(state, op, adjust);
        assertSlotsValid(state.slots, expectedTotals);
      }),
      { numRuns: 40, seed: 20261126 },
    );
  });
});
