/**
 * Pure hotbar slot view-model derivation — no Phaser — so it round-trips through a
 * plain vitest test against a fake (or, later, real) inventory snapshot.
 */
import type { HotbarSlotData } from "./fakeData.js";

export interface HotbarSlotView {
  index: number;
  itemId: string | null;
  count: number;
  keybind: string;
  selected: boolean;
  armed: boolean;
}

export const HOTBAR_SLOT_COUNT = 9;

/** Builds all nine slot view-models from a (possibly short/sparse) inventory snapshot. */
export function hotbarSlotViews(
  slots: HotbarSlotData[],
  selectedSlot: number,
  armedThrowableSlot: number | null,
): HotbarSlotView[] {
  return Array.from({ length: HOTBAR_SLOT_COUNT }, (_, index) => {
    const data = slots[index] ?? { itemId: null, count: 0 };
    return {
      index,
      itemId: data.itemId,
      count: data.count,
      keybind: String(index + 1),
      selected: index === selectedSlot,
      armed: index === armedThrowableSlot,
    };
  });
}
