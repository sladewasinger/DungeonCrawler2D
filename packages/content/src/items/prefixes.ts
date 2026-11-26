/** Rolled gear prefixes with stat modifiers, rarity bumps, and combat/utility perks. */

export type ItemPerkKind = "bleed" | "burn" | "poison" | "lifesteal" | "thorns" | "glow";
export type PrefixTargetGroup = "weapon" | "tool" | "armor" | "offhand" | "bow";

export interface ItemPrefixDef {
  readonly id: string;
  readonly label: string;
  readonly targets: readonly PrefixTargetGroup[];
  readonly rarityBump: 0 | 1 | 2;
  readonly damageDelta?: number;
  readonly defenseDelta?: number;
  readonly critChanceDelta?: number;
  readonly critMultDelta?: number;
  readonly staminaCostDelta?: number;
  readonly maxHpBonus?: number;
  readonly maxStaminaBonus?: number;
  readonly staminaRegenBonus?: number;
  readonly moveSpeedMult?: number;
  readonly stealthVisMult?: number;
  readonly backstabBonus?: number;
  readonly bowDrawSpeedMult?: number;
  readonly perk?: ItemPerkKind;
  readonly perkValue?: number;
}

export const PREFIX_CATALOG: readonly ItemPrefixDef[] = [
  { id: "keen", label: "Keen", targets: ["weapon", "tool"], rarityBump: 1, damageDelta: 3, critChanceDelta: 0.08 },
  { id: "vicious", label: "Vicious", targets: ["weapon"], rarityBump: 1, damageDelta: 5, critMultDelta: 0.25 },
  { id: "swift", label: "Swift", targets: ["weapon", "tool"], rarityBump: 1, staminaCostDelta: -2, moveSpeedMult: 0.04 },
  { id: "vampiric", label: "Vampiric", targets: ["weapon"], rarityBump: 2, damageDelta: 2, perk: "lifesteal", perkValue: 0.12 },
  { id: "blazing", label: "Blazing", targets: ["weapon"], rarityBump: 2, damageDelta: 3, perk: "burn", perkValue: 5 },
  { id: "venomous", label: "Venomous", targets: ["weapon"], rarityBump: 1, damageDelta: 2, perk: "poison", perkValue: 4 },
  { id: "serrated", label: "Serrated", targets: ["weapon"], rarityBump: 1, damageDelta: 3, perk: "bleed", perkValue: 4 },
  { id: "stalwart", label: "Stalwart", targets: ["armor", "offhand"], rarityBump: 1, defenseDelta: 2, maxHpBonus: 15 },
  { id: "shadow-woven", label: "Shadow-Woven", targets: ["armor"], rarityBump: 1, defenseDelta: 1, stealthVisMult: -0.12, backstabBonus: 0.15 },
  { id: "fleet", label: "Fleet", targets: ["armor"], rarityBump: 1, defenseDelta: 1, moveSpeedMult: 0.07, staminaRegenBonus: 3 },
  { id: "vital", label: "Vital", targets: ["armor", "offhand"], rarityBump: 1, defenseDelta: 1, maxHpBonus: 25 },
  { id: "thorny", label: "Thorny", targets: ["armor", "offhand"], rarityBump: 2, defenseDelta: 2, perk: "thorns", perkValue: 4 },
  { id: "radiant", label: "Radiant", targets: ["weapon", "armor", "offhand"], rarityBump: 2, maxHpBonus: 15, perk: "glow", perkValue: 55 },
  { id: "runed", label: "Runed", targets: ["weapon", "armor"], rarityBump: 2, damageDelta: 4, defenseDelta: 2, critChanceDelta: 0.06 },
  { id: "heavy", label: "Heavy", targets: ["weapon", "armor"], rarityBump: 0, damageDelta: 4, defenseDelta: 2, moveSpeedMult: -0.03 },
  { id: "lightweight", label: "Lightweight", targets: ["weapon", "armor"], rarityBump: 0, moveSpeedMult: 0.05, maxStaminaBonus: 12 },
  { id: "hunters", label: "Hunter's", targets: ["bow", "armor"], rarityBump: 1, critChanceDelta: 0.1, bowDrawSpeedMult: 0.15 },
  { id: "ancient", label: "Ancient", targets: ["weapon", "armor", "offhand"], rarityBump: 2, damageDelta: 4, defenseDelta: 2, critChanceDelta: 0.1, maxHpBonus: 15 },
];

const PREFIX_MAP = new Map<string, ItemPrefixDef>(PREFIX_CATALOG.map((p) => [p.id, p]));

export function getPrefixDef(prefixId: string | undefined | null): ItemPrefixDef | undefined {
  return prefixId ? PREFIX_MAP.get(prefixId) : undefined;
}

export function prefixGroupsForItem(opts: {
  readonly id: string;
  readonly category: string;
  readonly armorSlot?: string | undefined;
  readonly weaponArchetype?: string | undefined;
  readonly maxStack: number;
}): readonly PrefixTargetGroup[] {
  if (opts.maxStack > 1) return [];
  if (opts.weaponArchetype === "bow") return ["bow", "weapon"];
  if (opts.armorSlot === "offhand") return ["offhand", "armor"];
  if (opts.category === "armor") return ["armor"];
  if (opts.category === "weapon") return ["weapon"];
  if (opts.category === "tool") return ["tool"];
  return [];
}

export function eligiblePrefixesForItem(opts: {
  readonly id: string;
  readonly category: string;
  readonly armorSlot?: string | undefined;
  readonly weaponArchetype?: string | undefined;
  readonly maxStack: number;
}): readonly ItemPrefixDef[] {
  const groups = prefixGroupsForItem(opts);
  if (groups.length === 0) return [];
  return PREFIX_CATALOG.filter((p) => p.targets.some((t) => groups.includes(t)));
}
