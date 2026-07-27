/**
 * Pure row view-model shared by the stash window's two columns (inventory-to-stash
 * "put" and stash-to-inventory "take") — both sides are the same `{item, qty}[]`
 * shape, so one function builds either column. `index` is the row's position in the
 * *source* array as given, unsorted: doStash's server-side put/take (game-server/src/
 * sim/inventory.ts) addresses stacks by that same index, so display order must track
 * wire order exactly, never a client-side sort.
 */

export interface StashSlotLike {
  readonly item: string;
  readonly qty: number;
}

export interface StashRowView {
  index: number;
  itemId: string;
  name: string;
  qty: number;
}

export function stashRowViews(slots: readonly StashSlotLike[], nameOf: (itemId: string) => string): StashRowView[] {
  return slots.map((slot, index) => ({ index, itemId: slot.item, name: nameOf(slot.item), qty: slot.qty }));
}
