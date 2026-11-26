/** Pure stat-comparison & perk-description builder for the Item Card popover. */
import { resolveItemInstance, type ItemPerkKind, type ResolvedItemStats } from "@dc2d/content";
import type { ArmorSlotKey, InventorySnapshot, SlotItem } from "@dc2d/engine";

export interface StatLine {
  readonly label: string;
  readonly value: string;
  readonly deltaText?: string | undefined;
  readonly deltaTone?: "better" | "worse" | "neutral" | undefined;
}

const PERK_LABELS: Readonly<Record<ItemPerkKind, (v: number) => string>> = {
  bleed: (v) => `Bleed: Inflicts ${v} bleed trauma on hit`,
  burn: (v) => `Ignite: Burns targets (${v} dmg/tick) & lights braziers`,
  poison: (v) => `Venom: Inflicts poison (${v} dmg/tick)`,
  lifesteal: (v) => `Lifesteal: Restores ${Math.round(v * 100)}% of melee damage`,
  thorns: (v) => `Thorns: Reflects ${v} melee damage to attackers`,
  glow: (v) => `Radiant: +${v}px carried light radius`,
};

export function resolveUpgradedItemStats(
  itemId: string,
  opts?: { readonly prefixId?: string | null | undefined; readonly upgradeLevel?: number | undefined },
): ResolvedItemStats {
  const base = resolveItemInstance(itemId, opts?.prefixId);
  const lv = Math.max(0, Math.min(3, Math.floor(opts?.upgradeLevel ?? 0)));
  if (lv <= 0) return base;
  return {
    ...base,
    damage: base.damage > 0 ? Math.round(base.damage * (1 + lv * 0.15)) : 0,
    defense: base.defense > 0 ? base.defense + lv : 0,
  };
}

function isSameSignature(a: SlotItem, b: SlotItem): boolean {
  return a.itemId === b.itemId && a.prefixId === b.prefixId && (a.upgradeLevel ?? 0) === (b.upgradeLevel ?? 0);
}

const isWeaponOrTool = (cat: string | undefined): boolean => cat === "weapon" || cat === "tool";

function findWeaponComparison(inv: InventorySnapshot, target: SlotItem): ResolvedItemStats | null {
  const held = inv.slots[inv.selectedHotbar];
  if (!held || isSameSignature(held, target)) return null;
  const heldDef = resolveItemInstance(held.itemId, held.prefixId).def;
  return isWeaponOrTool(heldDef?.category) ? resolveUpgradedItemStats(held.itemId, held) : null;
}

export function findComparisonItem(inv: InventorySnapshot, target: SlotItem, isArmorSlot: boolean): ResolvedItemStats | null {
  const def = resolveItemInstance(target.itemId, target.prefixId).def;
  if (!def || isArmorSlot) return null;
  if (!def.armorSlot) return isWeaponOrTool(def.category) ? findWeaponComparison(inv, target) : null;
  const key = def.armorSlot as ArmorSlotKey;
  const eqId = inv.armor[key];
  return eqId ? resolveUpgradedItemStats(eqId, { prefixId: inv.armorPrefixes?.[key], upgradeLevel: inv.armorUpgrades?.[key] }) : null;
}

function deltaEntry(opts: {
  readonly label: string; readonly cur: number; readonly cmp: number | undefined;
  readonly fmt: (n: number) => string; readonly fmtDelta: (d: number) => string; readonly lowerIsBetter?: boolean;
}): StatLine {
  if (opts.cmp === undefined) return { label: opts.label, value: opts.fmt(opts.cur) };
  const diff = opts.cur - opts.cmp;
  if (Math.abs(diff) < 0.001) return { label: opts.label, value: opts.fmt(opts.cur) };
  const better = opts.lowerIsBetter ? diff < 0 : diff > 0;
  return {
    label: opts.label, value: opts.fmt(opts.cur),
    deltaText: `${diff > 0 ? "+" : ""}${opts.fmtDelta(diff)}`,
    deltaTone: better ? "better" : "worse",
  };
}

function appendCombatLines(out: StatLine[], item: ResolvedItemStats, cmp: ResolvedItemStats | null): void {
  const specs: readonly { readonly label: string; readonly cur: number; readonly cmp: number | undefined; readonly fmt: (n: number) => string; readonly fmtDelta: (d: number) => string; readonly lowerIsBetter?: boolean }[] = [
    { label: "Damage", cur: item.damage, cmp: cmp?.damage, fmt: String, fmtDelta: (d) => String(Math.round(d)) },
    { label: "Defense", cur: item.defense, cmp: cmp?.defense, fmt: (n) => `+${n}`, fmtDelta: (d) => String(Math.round(d)) },
    { label: "Block", cur: item.blockMitigation * 100, cmp: cmp ? cmp.blockMitigation * 100 : undefined, fmt: (n) => `${Math.round(n)}%`, fmtDelta: (d) => `${Math.round(d)}%` },
    { label: "Crit Chance", cur: item.critChance * 100, cmp: cmp ? cmp.critChance * 100 : undefined, fmt: (n) => `+${Math.round(n)}%`, fmtDelta: (d) => `${Math.round(d)}%` },
    { label: "Stamina", cur: item.staminaCost, cmp: cmp?.staminaCost, fmt: String, fmtDelta: (d) => String(Math.round(d)), lowerIsBetter: true },
  ];
  for (const s of specs) {
    if (s.cur > 0) out.push(deltaEntry(s));
  }
}

function appendBonusLines(out: StatLine[], item: ResolvedItemStats): void {
  const entries: readonly (readonly [string, number, string])[] = [
    ["Crit Mult", item.critMult > 1.51 ? item.critMult : 0, `${item.critMult.toFixed(2)}×`],
    ["Range", item.range, `${item.range.toFixed(1)}t`],
    ["Max HP", item.maxHpBonus, `+${item.maxHpBonus}`],
    ["Max Stamina", item.maxStaminaBonus, `+${item.maxStaminaBonus}`],
    ["Stam Regen", item.staminaRegenBonus, `+${item.staminaRegenBonus}/s`],
    ["Move Speed", item.moveSpeedMult, `${item.moveSpeedMult > 0 ? "+" : ""}${Math.round(item.moveSpeedMult * 100)}%`],
    ["Visibility", item.stealthVisMult, `${Math.round(item.stealthVisMult * 100)}%`],
    ["Backstab", item.backstabBonus, `+${Math.round(item.backstabBonus * 100)}%`],
    ["Draw Speed", item.bowDrawSpeedMult, `+${Math.round(item.bowDrawSpeedMult * 100)}%`],
    ["Restore HP", item.healHp, `+${item.healHp}`],
    ["Well-Fed", item.wellFedSec, `${item.wellFedSec}s`],
  ];
  for (const [label, cond, value] of entries) {
    if (cond !== 0) out.push({ label, value });
  }
}

export function buildItemStatLines(item: ResolvedItemStats, cmp: ResolvedItemStats | null): readonly StatLine[] {
  const lines: StatLine[] = [];
  appendCombatLines(lines, item, cmp);
  appendBonusLines(lines, item);
  return lines;
}

export function formatPerkLabels(item: ResolvedItemStats): readonly string[] {
  const out = item.perks.map((p) => PERK_LABELS[p.kind](p.value));
  const buff = item.def?.buffEffect;
  if (buff) out.push(`Buff: ${buff.kind.toUpperCase()} for ${buff.durationSec}s`);
  if (item.def?.curesStatuses) out.push("Cleanse: Cures Burn, Poison & Bleed");
  return out;
}
