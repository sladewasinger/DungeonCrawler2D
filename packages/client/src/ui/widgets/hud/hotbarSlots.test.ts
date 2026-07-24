// Headless test for the hotbar's pure slot-derivation logic against a fake inventory snapshot.
import { describe, expect, it } from "vitest";
import type { HotbarSlotData } from "./fakeData.js";
import { HOTBAR_SLOT_COUNT, hotbarSlotViews } from "./hotbarSlots.js";

function inventory(): HotbarSlotData[] {
  return [
    { itemId: "sword", count: 1 },
    { itemId: "bandage", count: 3 },
  ];
}

describe("hotbarSlotViews", () => {
  it("always returns exactly nine slots, padding missing ones as empty", () => {
    const views = hotbarSlotViews(inventory(), 0, null);
    expect(views).toHaveLength(HOTBAR_SLOT_COUNT);
    expect(views[8]).toMatchObject({ itemId: null, count: 0, keybind: "9" });
  });

  it("binds real item/count data from the snapshot onto the matching slot index", () => {
    const views = hotbarSlotViews(inventory(), 0, null);
    expect(views[0]).toMatchObject({ itemId: "sword", count: 1, keybind: "1" });
    expect(views[1]).toMatchObject({ itemId: "bandage", count: 3, keybind: "2" });
  });

  it("marks exactly the selected slot as selected", () => {
    const views = hotbarSlotViews(inventory(), 1, null);
    expect(views[0]?.selected).toBe(false);
    expect(views[1]?.selected).toBe(true);
  });

  it("marks the selected throwable slot independently of weapon equipment", () => {
    const views = hotbarSlotViews(inventory(), 0, 1);
    expect(views[0]).toMatchObject({ selected: true, armed: false });
    expect(views[1]).toMatchObject({ selected: false, armed: true });
  });

  it("no armed slot when armedThrowableSlot is null", () => {
    const views = hotbarSlotViews(inventory(), 0, null);
    expect(views.every((view) => !view.armed)).toBe(true);
  });
});
