/** Resolves effective item name, rarity, stats, and active perks from base ItemDef + optional prefixId. */
import { getItemDef, type ItemDef } from "./catalog.js";
import { getPrefixDef, type ItemPerkKind, type ItemPrefixDef } from "./prefixes.js";
import { bumpRarity, type ItemRarity } from "./rarities.js";

export interface ResolvedItemStats {
  readonly itemId: string;
  readonly prefixId?: string | undefined;
  readonly displayName: string;
  readonly baseName: string;
  readonly rarity: ItemRarity;
  readonly description: string;
  readonly def: ItemDef | undefined;
  readonly prefix: ItemPrefixDef | undefined;
  readonly damage: number;
  readonly defense: number;
  readonly blockMitigation: number;
  readonly staminaCost: number;
  readonly range: number;
  readonly critChance: number;
  readonly critMult: number;
  readonly maxHpBonus: number;
  readonly maxStaminaBonus: number;
  readonly staminaRegenBonus: number;
  readonly moveSpeedMult: number;
  readonly stealthVisMult: number;
  readonly backstabBonus: number;
  readonly bowDrawSpeedMult: number;
  readonly healHp: number;
  readonly wellFedSec: number;
  readonly perks: readonly { readonly kind: ItemPerkKind; readonly value: number }[];
}

const num = (v: number | undefined): number => v || 0;
const EMPTY_DEF: Partial<ItemDef> = {};
const EMPTY_PREF: Partial<ItemPrefixDef> = {};

function collectPerks(d: Partial<ItemDef>, p: Partial<ItemPrefixDef>): readonly { readonly kind: ItemPerkKind; readonly value: number }[] {
  const out: { readonly kind: ItemPerkKind; readonly value: number }[] = [];
  if (d.perk) out.push({ kind: d.perk, value: d.perkValue || 1 });
  if (p.perk && p.perk !== d.perk) out.push({ kind: p.perk, value: p.perkValue || 1 });
  return out;
}

function resolveCombatNumbers(d: Partial<ItemDef>, p: Partial<ItemPrefixDef>) {
  const baseDmg = num(d.damage);
  const baseStam = num(d.staminaCost);
  return {
    damage: baseDmg > 0 ? Math.max(1, baseDmg + num(p.damageDelta)) : 0,
    defense: Math.max(0, num(d.defense) + num(p.defenseDelta)),
    blockMitigation: num(d.blockMitigation),
    staminaCost: baseStam > 0 ? Math.max(3, baseStam + num(p.staminaCostDelta)) : 0,
    range: num(d.range),
    critChance: Math.max(0, num(d.critChance) + num(p.critChanceDelta)),
    critMult: Math.max(1.5, (d.critMult || 1.5) + num(p.critMultDelta)),
  };
}

function resolveBonusNumbers(d: Partial<ItemDef>, p: Partial<ItemPrefixDef>) {
  return {
    maxHpBonus: num(d.maxHpBonus) + num(p.maxHpBonus),
    maxStaminaBonus: num(d.maxStaminaBonus) + num(p.maxStaminaBonus),
    staminaRegenBonus: num(d.staminaRegenBonus) + num(p.staminaRegenBonus),
    moveSpeedMult: num(d.moveSpeedMult) + num(p.moveSpeedMult),
    stealthVisMult: num(d.stealthVisMult) + num(p.stealthVisMult),
    backstabBonus: num(d.backstabBonus) + num(p.backstabBonus),
    bowDrawSpeedMult: num(d.bowDrawSpeedMult) + num(p.bowDrawSpeedMult),
    healHp: num(d.healHp),
    wellFedSec: num(d.wellFedSec),
  };
}

function resolveBaseMeta(d: Partial<ItemDef>, p: Partial<ItemPrefixDef>, itemId: string) {
  const baseName = d.name || itemId;
  return {
    displayName: p.label ? `${p.label} ${baseName}` : baseName,
    baseName,
    rarity: bumpRarity(d.rarity || "common", p.rarityBump || 0),
    description: d.description || "A frontier item.",
  };
}

export function resolveItemInstance(itemId: string, prefixId?: string | null): ResolvedItemStats {
  const def = getItemDef(itemId);
  const prefix = getPrefixDef(prefixId);
  const d = def || EMPTY_DEF;
  const p = prefix || EMPTY_PREF;
  return {
    itemId,
    ...(prefix ? { prefixId: prefix.id } : {}),
    ...resolveBaseMeta(d, p, itemId),
    def,
    prefix,
    ...resolveCombatNumbers(d, p),
    ...resolveBonusNumbers(d, p),
    perks: collectPerks(d, p),
  };
}
