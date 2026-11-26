/** Unit tests for prefix preservation, armor prefix swapping, and aggregated player gear stats. */
import { describe, expect, it } from "vitest";
import { createEmptyChestSlots, transferChestSlot } from "./chestOps.js";
import { equipArmorFromSlot, unequipArmorToSlot } from "./armorOps.js";
import { computePlayerGearStats, type GearPieceStats } from "./gearStats.js";
import { createEmptyInventoryState, moveOrSwapSlot } from "./slotModel.js";

const CUIRASS_ID = "iron-knight-cuirass";
const PREFIX_STALWART = "stalwart";
const PREFIX_VAMP = "vampiric";

const FIXTURE_STATS: Readonly<Record<string, GearPieceStats & { readonly armorSlot?: "head" | "chest" | "legs" | "feet" | "offhand" }>> = {
  "iron-knight-cuirass": { armorSlot: "chest", defense: 10, damage: 0, staminaCost: 0, critChance: 0, critMult: 1.5, maxHpBonus: 25, maxStaminaBonus: 0, staminaRegenBonus: 0, moveSpeedMult: 0, stealthVisMult: 0, backstabBonus: 0, bowDrawSpeedMult: 0, perks: [] },
  "runic-buckler": { armorSlot: "offhand", defense: 5, damage: 0, staminaCost: 0, critChance: 0.05, critMult: 1.5, maxHpBonus: 0, maxStaminaBonus: 0, staminaRegenBonus: 0, moveSpeedMult: 0, stealthVisMult: 0, backstabBonus: 0, bowDrawSpeedMult: 0, perks: [{ kind: "thorns", value: 5 }] },
  "bloodmoon-scythe": { defense: 0, damage: 38, staminaCost: 18, critChance: 0.22, critMult: 1.5, maxHpBonus: 0, maxStaminaBonus: 0, staminaRegenBonus: 0, moveSpeedMult: 0, stealthVisMult: 0, backstabBonus: 0, bowDrawSpeedMult: 0, perks: [{ kind: "lifesteal", value: 0.15 }] },
};

const EMPTY: GearPieceStats = {
  defense: 0, damage: 0, staminaCost: 0, critChance: 0, critMult: 1.5,
  maxHpBonus: 0, maxStaminaBonus: 0, staminaRegenBonus: 0, moveSpeedMult: 0,
  stealthVisMult: 0, backstabBonus: 0, bowDrawSpeedMult: 0, perks: [],
};

function fixtureLookup(itemId: string, prefixId?: string | null): GearPieceStats & { readonly armorSlot?: "head" | "chest" | "legs" | "feet" | "offhand" } {
  const base = FIXTURE_STATS[itemId] ?? EMPTY;
  if (prefixId === PREFIX_STALWART) return { ...base, defense: base.defense + 2, maxHpBonus: base.maxHpBonus + 15 };
  if (prefixId === "thorny") return { ...base, defense: base.defense + 2, perks: [...base.perks, { kind: "thorns", value: 4 }] };
  if (prefixId === "keen") return { ...base, damage: base.damage + 3, critChance: base.critChance + 0.08 };
  return base;
}

const maxStack = (id: string) => (id === "torch" ? 64 : 1);
const hasItem = (s: { readonly itemId: string } | null) => s?.itemId === CUIRASS_ID;

describe("Item prefixes & gear stats", () => {
  it("preserves prefixId across inventory moves and armor equip/unequip", () => {
    const state = createEmptyInventoryState();
    state.slots[0] = { itemId: CUIRASS_ID, count: 1, prefixId: PREFIX_STALWART };
    expect(moveOrSwapSlot(state.slots, { from: 0, to: 9 }, maxStack)).toBe(true);
    expect(state.slots[9]?.prefixId).toBe(PREFIX_STALWART);
    const equipped = equipArmorFromSlot(state, { slotIndex: 9 }, fixtureLookup);
    if (!equipped) throw new Error("expected equipped state");
    expect(equipped.armor.chest).toBe(CUIRASS_ID);
    expect(equipped.armorPrefixes?.chest).toBe(PREFIX_STALWART);
    const unequipped = unequipArmorToSlot(equipped, { armorSlot: "chest" }, { maxStackFor: maxStack, lookup: fixtureLookup });
    expect(unequipped?.slots.find(hasItem)?.prefixId).toBe(PREFIX_STALWART);
  });

  it("preserves prefixId across chest transfers", () => {
    const state = createEmptyInventoryState();
    state.slots[1] = { itemId: "bandit-cutlass", count: 1, prefixId: PREFIX_VAMP };
    const chest = createEmptyChestSlots();
    expect(transferChestSlot({
      chestSlots: chest, invSlots: state.slots, from: "inv", fromSlot: 1, to: "chest", toSlot: 0, maxStackFor: maxStack,
    })).toBe(true);
    expect(chest[0]?.prefixId).toBe(PREFIX_VAMP);
  });

  it("never merges stackable items with different prefixes", () => {
    const state = createEmptyInventoryState();
    state.slots[0] = { itemId: "torch", count: 2, prefixId: "radiant" };
    state.slots[1] = { itemId: "torch", count: 2 };
    expect(moveOrSwapSlot(state.slots, { from: 0, to: 1 }, maxStack)).toBe(true);
    expect(state.slots[1]?.prefixId).toBe("radiant");
    expect(state.slots[0]?.prefixId).toBeUndefined();
  });

  it("aggregates weapon, armor, prefix, and perk bonuses into real player stats", () => {
    const stats = computePlayerGearStats({
      armor: { head: null, chest: CUIRASS_ID, legs: null, feet: null, offhand: "runic-buckler" },
      armorPrefixes: { chest: PREFIX_STALWART, offhand: "thorny" },
      heldItem: { itemId: "bloodmoon-scythe", count: 1, prefixId: "keen" },
      lookup: fixtureLookup,
    });
    expect(stats.defense).toBe(19);
    expect(stats.heldDamage).toBe(41);
    expect(stats.maxHpBonus).toBe(40);
    expect(stats.lifestealRatio).toBeCloseTo(0.15);
    expect(stats.thornsDamage).toBe(9);
    expect(stats.critChance).toBeCloseTo(0.4);
  });
});
