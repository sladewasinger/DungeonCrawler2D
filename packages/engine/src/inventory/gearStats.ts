/** Pure aggregated player RPG stats & combat perks computed from equipped armor and held item. */
import { ARMOR_SLOT_KEYS, type ItemPerkKind } from "@dc2d/contracts";
import type { ArmorEquipment, ArmorPrefixMap, ArmorUpgradeMap, SlotItem } from "./slotModel.js";

export type GearPerkKind = ItemPerkKind;

export interface GearPieceStats {
  readonly defense: number;
  readonly damage: number;
  readonly staminaCost: number;
  readonly critChance: number;
  readonly critMult: number;
  readonly maxHpBonus: number;
  readonly maxStaminaBonus: number;
  readonly staminaRegenBonus: number;
  readonly moveSpeedMult: number;
  readonly stealthVisMult: number;
  readonly backstabBonus: number;
  readonly bowDrawSpeedMult: number;
  readonly perks: readonly { readonly kind: GearPerkKind; readonly value: number }[];
}

export type GearStatsLookup = (itemId: string, prefixId?: string | null) => GearPieceStats;

export interface AggregatedPlayerGearStats {
  readonly defense: number;
  readonly heldDamage: number;
  readonly heldStaminaCost: number;
  readonly critChance: number;
  readonly critMult: number;
  readonly maxHpBonus: number;
  readonly maxStaminaBonus: number;
  readonly staminaRegenBonus: number;
  readonly moveSpeedMult: number;
  readonly stealthVisMult: number;
  readonly backstabBonus: number;
  readonly bowDrawSpeedMult: number;
  readonly bleedDamage: number;
  readonly burnDamage: number;
  readonly poisonDamage: number;
  readonly lifestealRatio: number;
  readonly thornsDamage: number;
  readonly glowRadiusBonus: number;
}

interface MutableGearTotals {
  defense: number;
  heldDamage: number;
  heldStaminaCost: number;
  critChance: number;
  critMult: number;
  maxHpBonus: number;
  maxStaminaBonus: number;
  staminaRegenBonus: number;
  moveSpeedMult: number;
  stealthVisMult: number;
  backstabBonus: number;
  bowDrawSpeedMult: number;
  bleedDamage: number;
  burnDamage: number;
  poisonDamage: number;
  lifestealRatio: number;
  thornsDamage: number;
  glowRadiusBonus: number;
}

const HELD_DOT_FIELD: Partial<Readonly<Record<GearPerkKind, "bleedDamage" | "burnDamage" | "poisonDamage">>> = {
  bleed: "bleedDamage",
  burn: "burnDamage",
  poison: "poisonDamage",
};

function applyHeldPerk(tot: MutableGearTotals, p: { readonly kind: GearPerkKind; readonly value: number }): void {
  if (p.kind === "lifesteal") { tot.lifestealRatio = Math.min(0.4, tot.lifestealRatio + p.value); return; }
  const field = HELD_DOT_FIELD[p.kind];
  if (field) tot[field] = Math.max(tot[field], p.value);
}

function accumulatePerks(tot: MutableGearTotals, perks: GearPieceStats["perks"], isHeld: boolean): void {
  for (const p of perks) {
    if (p.kind === "thorns") tot.thornsDamage += p.value;
    else if (p.kind === "glow") tot.glowRadiusBonus += p.value;
    else if (isHeld) applyHeldPerk(tot, p);
  }
}

function accumulatePiece(
  tot: MutableGearTotals,
  entry: { readonly stats: GearPieceStats; readonly isHeld: boolean; readonly upgradeLevel?: number | undefined },
): void {
  const { stats: s, isHeld } = entry;
  const lv = Math.max(0, Math.min(3, Math.floor(entry.upgradeLevel ?? 0)));
  tot.defense += isHeld ? s.defense : s.defense + (s.defense > 0 ? lv : 0);
  if (isHeld) {
    tot.heldDamage = s.damage > 0 ? Math.round(s.damage * (1 + lv * 0.15)) : 0;
    tot.heldStaminaCost = s.staminaCost;
    tot.critMult = Math.max(tot.critMult, s.critMult);
  }
  tot.critChance += s.critChance;
  tot.maxHpBonus += s.maxHpBonus;
  tot.maxStaminaBonus += s.maxStaminaBonus;
  tot.staminaRegenBonus += s.staminaRegenBonus;
  tot.moveSpeedMult += s.moveSpeedMult;
  tot.stealthVisMult += s.stealthVisMult;
  tot.backstabBonus += s.backstabBonus;
  tot.bowDrawSpeedMult += s.bowDrawSpeedMult;
  accumulatePerks(tot, s.perks, isHeld);
}

export function computePlayerGearStats(input: {
  readonly armor: ArmorEquipment;
  readonly armorPrefixes?: ArmorPrefixMap | undefined;
  readonly armorUpgrades?: ArmorUpgradeMap | undefined;
  readonly heldItem?: SlotItem | null | undefined;
  readonly lookup: GearStatsLookup;
}): AggregatedPlayerGearStats {
  const tot: MutableGearTotals = {
    defense: 0, heldDamage: 0, heldStaminaCost: 0, critChance: 0.05, critMult: 1.5,
    maxHpBonus: 0, maxStaminaBonus: 0, staminaRegenBonus: 0, moveSpeedMult: 0,
    stealthVisMult: 0, backstabBonus: 0, bowDrawSpeedMult: 0,
    bleedDamage: 0, burnDamage: 0, poisonDamage: 0, lifestealRatio: 0, thornsDamage: 0, glowRadiusBonus: 0,
  };
  for (const key of ARMOR_SLOT_KEYS) {
    const id = input.armor[key];
    if (id) accumulatePiece(tot, { stats: input.lookup(id, input.armorPrefixes?.[key]), isHeld: false, upgradeLevel: input.armorUpgrades?.[key] });
  }
  if (input.heldItem) {
    accumulatePiece(tot, { stats: input.lookup(input.heldItem.itemId, input.heldItem.prefixId), isHeld: true, upgradeLevel: input.heldItem.upgradeLevel });
  }
  return {
    ...tot,
    critChance: Math.max(0, Math.min(0.75, tot.critChance)),
    moveSpeedMult: Math.max(-0.35, Math.min(0.6, tot.moveSpeedMult)),
  };
}
