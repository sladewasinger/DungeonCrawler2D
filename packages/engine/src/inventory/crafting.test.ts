import { describe, expect, it } from "vitest";
import { computeArmorDefense, equipArmorFromSlot, unequipArmorToSlot, type ArmorItemRule } from "./armorOps.js";
import { canCraftRecipe, countItemInSlots, craftRecipeInState, type CraftRecipe } from "./crafting.js";
import { createEmptyInventoryState, insertIntoSlots, moveOrSwapSlot } from "./slotModel.js";

const ITEM_HOOD = "leather-hood";
const ITEM_HELM = "iron-helm";
const ITEM_SWORD = "sword";
const ITEM_AXE = "axe";
const ITEM_WOOD = "wood";
const ITEM_STONE = "stone";
const ITEM_RAW_MEAT = "raw-meat";
const ITEM_COOKED_MEAT = "cooked-meat";
const HEAD_SLOT = "head";

const RULES = new Map<string, ArmorItemRule & { maxStack: number }>([
  [ITEM_SWORD, { maxStack: 1 }],
  [ITEM_AXE, { maxStack: 1 }],
  [ITEM_HOOD, { maxStack: 1, armorSlot: HEAD_SLOT, defense: 2 }],
  [ITEM_HELM, { maxStack: 1, armorSlot: HEAD_SLOT, defense: 5 }],
  [ITEM_WOOD, { maxStack: 64 }],
  [ITEM_STONE, { maxStack: 64 }],
  [ITEM_RAW_MEAT, { maxStack: 16 }],
  [ITEM_COOKED_MEAT, { maxStack: 16 }],
]);

const maxStackFor = (id: string): number => RULES.get(id)?.maxStack ?? 64;
const armorRuleFor = (id: string): ArmorItemRule | undefined => RULES.get(id);

const AXE_RECIPE: CraftRecipe = {
  id: "craft-axe",
  outputItemId: ITEM_AXE,
  outputCount: 1,
  ingredients: [
    { itemId: ITEM_WOOD, count: 3 },
    { itemId: ITEM_STONE, count: 2 },
  ],
};

const COOK_RECIPE: CraftRecipe = {
  id: "craft-cooked-meat",
  outputItemId: ITEM_COOKED_MEAT,
  outputCount: 1,
  requiresCampfire: true,
  ingredients: [{ itemId: ITEM_RAW_MEAT, count: 1 }],
};

describe("inventory armorOps & crafting", () => {
  it("never stacks maxStack=1 weapons/armor and preserves clean slot swaps", () => {
    const inv = createEmptyInventoryState();
    insertIntoSlots(inv.slots, { itemId: ITEM_SWORD, count: 1 }, maxStackFor);
    insertIntoSlots(inv.slots, { itemId: ITEM_SWORD, count: 1 }, maxStackFor);
    expect(inv.slots[0]).toEqual({ itemId: ITEM_SWORD, count: 1 });
    expect(inv.slots[1]).toEqual({ itemId: ITEM_SWORD, count: 1 });
    expect(moveOrSwapSlot(inv.slots, { from: 0, to: 10 }, maxStackFor)).toBe(true);
    expect(inv.slots[0]).toBeNull();
    expect(inv.slots[10]).toEqual({ itemId: ITEM_SWORD, count: 1 });
  });

  it("equips, swaps, unequips armor and computes total defense", () => {
    const inv = createEmptyInventoryState();
    inv.slots[9] = { itemId: ITEM_HOOD, count: 1 };
    inv.slots[10] = { itemId: ITEM_HELM, count: 1 };

    const equipped = equipArmorFromSlot(inv, { slotIndex: 9 }, armorRuleFor);
    if (!equipped) throw new Error("expected equip to succeed");
    expect(equipped.armor.head).toBe(ITEM_HOOD);
    expect(equipped.slots[9]).toBeNull();
    expect(computeArmorDefense(equipped.armor, armorRuleFor)).toBe(2);

    const swapped = equipArmorFromSlot(equipped, { slotIndex: 10, targetArmor: HEAD_SLOT }, armorRuleFor);
    if (!swapped) throw new Error("expected swap to succeed");
    expect(swapped.armor.head).toBe(ITEM_HELM);
    expect(swapped.slots[10]).toEqual({ itemId: ITEM_HOOD, count: 1 });

    const unequipped = unequipArmorToSlot(swapped, { armorSlot: HEAD_SLOT, targetSlot: 2 }, { maxStackFor, lookup: armorRuleFor });
    if (!unequipped) throw new Error("expected unequip to succeed");
    expect(unequipped.armor.head).toBeNull();
    expect(unequipped.slots[2]).toEqual({ itemId: ITEM_HELM, count: 1 });
  });

  it("enforces ingredient counts and campfire proximity when crafting", () => {
    const inv = createEmptyInventoryState();
    insertIntoSlots(inv.slots, { itemId: ITEM_WOOD, count: 5 }, maxStackFor);
    insertIntoSlots(inv.slots, { itemId: ITEM_STONE, count: 3 }, maxStackFor);
    insertIntoSlots(inv.slots, { itemId: ITEM_RAW_MEAT, count: 2 }, maxStackFor);

    expect(canCraftRecipe({ slots: inv.slots, recipe: AXE_RECIPE, nearCampfire: false, maxStackFor })).toBe(true);
    const crafted = craftRecipeInState(inv, { recipe: AXE_RECIPE, nearCampfire: false, maxStackFor });
    if (!crafted) throw new Error("expected axe craft to succeed");
    expect(countItemInSlots(crafted.slots, ITEM_AXE)).toBe(1);
    expect(countItemInSlots(crafted.slots, ITEM_WOOD)).toBe(2);

    expect(canCraftRecipe({ slots: inv.slots, recipe: COOK_RECIPE, nearCampfire: false, maxStackFor })).toBe(false);
    const cooked = craftRecipeInState(inv, { recipe: COOK_RECIPE, nearCampfire: true, maxStackFor });
    if (!cooked) throw new Error("expected campfire cook to succeed");
    expect(countItemInSlots(cooked.slots, ITEM_COOKED_MEAT)).toBe(1);
    expect(countItemInSlots(cooked.slots, ITEM_RAW_MEAT)).toBe(1);
  });
});
