import { describe, expect, it } from "vitest";
import { resolvePointerDrop, type MeasuredSlot, type MeasuredZone, type RectLike } from "./slotDropResolver.js";

function gridRect(col: number, row: number, origin: readonly [number, number]): RectLike {
  const left = origin[0] + col * 45;
  const top = origin[1] + row * 45;
  return { left, top, right: left + 40, bottom: top + 40 };
}

function buildChestAndBagSetup() {
  const zones: MeasuredZone[] = [
    { zone: "modal", rect: { left: 100, top: 100, right: 640, bottom: 280 } },
    { zone: "chest", rect: { left: 112, top: 130, right: 350, bottom: 265 } },
    { zone: "backpack", rect: { left: 370, top: 130, right: 625, bottom: 265 } },
    { zone: "hotbar", rect: { left: 160, top: 320, right: 580, bottom: 376 } },
  ];
  const slots: MeasuredSlot[] = [
    { source: { kind: "chest", index: 0 }, zone: "chest", rect: gridRect(0, 0, [112, 130]), item: { itemId: "wood", count: 5 } },
    { source: { kind: "slot", index: 9 }, zone: "backpack", rect: gridRect(0, 0, [370, 130]), item: { itemId: "sword", count: 1 } },
    { source: { kind: "slot", index: 10 }, zone: "backpack", rect: gridRect(1, 0, [370, 130]), item: null },
    { source: { kind: "slot", index: 11 }, zone: "backpack", rect: gridRect(2, 0, [370, 130]), item: { itemId: "wood", count: 12 } },
    { source: { kind: "slot", index: 0 }, zone: "hotbar", rect: gridRect(0, 0, [165, 326]), item: { itemId: "wooden-spear", count: 1 } },
    { source: { kind: "slot", index: 1 }, zone: "hotbar", rect: gridRect(1, 0, [165, 326]), item: null },
  ];
  return { zones, slots };
}

describe("slotDropResolver", () => {
  it("fills nearest open backpack slot when dropping from chest in-between grid spaces or overlapping an occupied slot", () => {
    const { zones, slots } = buildChestAndBagSetup();
    const from = { kind: "chest", index: 0 } as const;

    // Directly overlapping occupied sword slot (370..410, 130..170) -> picks nearby empty slot 10 instead of failing or swapping
    const overOccupied = resolvePointerDrop({ x: 392, y: 150, from, itemId: "torch", maxStack: 64, zones, slots });
    expect(overOccupied).toEqual({ kind: "transfer", target: { kind: "slot", index: 10 } });

    // In the 5px gap between slot 9 and slot 10 -> picks empty slot 10
    const inGap = resolvePointerDrop({ x: 412, y: 150, from, itemId: "torch", maxStack: 64, zones, slots });
    expect(inGap).toEqual({ kind: "transfer", target: { kind: "slot", index: 10 } });

    // Near partial stack of wood (slot 11 at x=460..500) -> merges into slot 11
    const nearStack = resolvePointerDrop({ x: 458, y: 150, from, itemId: "wood", maxStack: 64, zones, slots });
    expect(nearStack).toEqual({ kind: "transfer", target: { kind: "slot", index: 11 } });
  });

  it("handles same-container gap snapping while keeping intentional inner swaps intact", () => {
    const { zones, slots } = buildChestAndBagSetup();
    const from = { kind: "slot", index: 11 } as const;

    // Grazing outer 2px edge of occupied slot 9 near gap toward empty slot 10 -> snaps to empty slot 10
    const grazed = resolvePointerDrop({ x: 409, y: 150, from, itemId: "wood", maxStack: 64, zones, slots });
    expect(grazed).toEqual({ kind: "transfer", target: { kind: "slot", index: 10 } });

    // Clicking squarely inside occupied slot 9 (inset >= 5px) -> intentional swap with slot 9
    const centered = resolvePointerDrop({ x: 390, y: 150, from, itemId: "wood", maxStack: 64, zones, slots });
    expect(centered).toEqual({ kind: "transfer", target: { kind: "slot", index: 9 } });
  });

  it("detects world drop outside HUD while guarding the modal-to-hotbar corridor", () => {
    const { zones, slots } = buildChestAndBagSetup();
    const from = { kind: "slot", index: 11 } as const;

    // Between modal (bottom=280) and hotbar (top=320) stays safe inside HUD
    const corridor = resolvePointerDrop({ x: 400, y: 300, from, itemId: "wood", maxStack: 64, zones, slots });
    expect(corridor.kind).not.toBe("worldDrop");

    // Clearly outside HUD (>26px past left/top/right edge) triggers worldDrop
    const outside = resolvePointerDrop({ x: 40, y: 180, from, itemId: "wood", maxStack: 64, zones, slots });
    expect(outside).toEqual({ kind: "worldDrop" });
  });

  it("swaps directly onto occupied backpack slot when chest-to-bag transfer targets a full inventory", () => {
    const { zones, slots } = buildChestAndBagSetup();
    const fullSlots = slots.map((s) => (s.item === null ? { ...s, item: { itemId: "flint-dagger", count: 1 } } : s));
    const swap = resolvePointerDrop({
      x: 390, y: 150, from: { kind: "chest", index: 0 }, itemId: "copper-sword", maxStack: 1, zones, slots: fullSlots,
    });
    expect(swap).toEqual({ kind: "transfer", target: { kind: "slot", index: 9 } });
  });
});
