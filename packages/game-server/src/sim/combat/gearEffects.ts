/** Server-side RPG gear stat aggregation, crit rolls, on-hit perks, thorns, and elixir use. */
import { getItemDef, resolveItemInstance } from "@dc2d/content";
import {
  computeArmorDefense, computePlayerGearStats, consumeItemFromSlots, removeFromSlot,
  type AggregatedPlayerGearStats, type WorldEvent,
} from "@dc2d/engine";
import type { CombatPlayerRef } from "../combatActions.js";
import { igniteBurnable, inflictPoison } from "./statusEffects.js";
import type { WildlifeEntity } from "../wildlife/creatureSpecs.js";

const EMPTY_PIECE = {
  defense: 0, damage: 0, staminaCost: 0, critChance: 0, critMult: 1.5,
  maxHpBonus: 0, maxStaminaBonus: 0, staminaRegenBonus: 0,
  moveSpeedMult: 0, stealthVisMult: 0, backstabBonus: 0, bowDrawSpeedMult: 0, perks: [],
} as const;

export function resolvePlayerGear(p: CombatPlayerRef): AggregatedPlayerGearStats {
  return computePlayerGearStats({
    armor: p.inventory.armor,
    armorPrefixes: p.inventory.armorPrefixes,
    heldItem: p.inventory.slots[p.selectedHotbar],
    lookup: (itemId, prefixId) => {
      const r = resolveItemInstance(itemId, prefixId);
      return r.def ? r : EMPTY_PIECE;
    },
  });
}

export function resolveArmorDefenseFor(p: CombatPlayerRef): number {
  return computeArmorDefense(
    p.inventory.armor,
    (id, prefixId) => resolveItemInstance(id, prefixId),
    p.inventory.armorPrefixes,
  );
}

export function rollCritDamage(baseDamage: number, gear: AggregatedPlayerGearStats): { readonly damage: number; readonly isCrit: boolean } {
  if (Math.random() >= gear.critChance) return { damage: baseDamage, isCrit: false };
  return { damage: Math.max(1, Math.round(baseDamage * gear.critMult)), isCrit: true };
}

export function computeGearStrikeOutcome(opts: {
  readonly baseHit: number;
  readonly sneakHit: boolean;
  readonly gear: AggregatedPlayerGearStats;
  readonly baseHitstop?: number | undefined;
  readonly baseShake?: number | undefined;
  readonly backstabHitstop: number;
  readonly backstabShake: number;
}): { readonly damage: number; readonly hitstopSec: number | undefined; readonly shakePx: number | undefined } {
  const { damage, isCrit } = rollCritDamage(opts.baseHit, opts.gear);
  const hitstopSec = opts.sneakHit ? opts.backstabHitstop : opts.baseHitstop;
  const shakePx = opts.sneakHit ? opts.backstabShake : (isCrit ? Math.max(opts.baseShake ?? 0, 2.5) : opts.baseShake);
  return { damage, hitstopSec, shakePx };
}

function applyOnHitLifesteal(opts: {
  readonly attacker: CombatPlayerRef; readonly ratio: number; readonly damageDealt: number; readonly events: WorldEvent[];
}): void {
  const { attacker, ratio, damageDealt, events } = opts;
  if (ratio <= 0 || damageDealt <= 0 || attacker.combat.hp <= 0) return;
  const heal = Math.max(1, Math.round(damageDealt * ratio));
  attacker.combat.hp = Math.min(attacker.combat.maxHp, attacker.combat.hp + heal);
  events.push({ kind: "heal", x: attacker.x, y: attacker.y, value: heal, actorId: attacker.id });
}

export function applyPlayerOnHitPerks(opts: {
  readonly attacker: CombatPlayerRef;
  readonly gear: AggregatedPlayerGearStats;
  readonly target: WildlifeEntity;
  readonly damageDealt: number;
  readonly events: WorldEvent[];
}): void {
  const { attacker, gear, target, damageDealt, events } = opts;
  applyOnHitLifesteal({ attacker, ratio: gear.lifestealRatio, damageDealt, events });
  if (target.hp <= 0 || target.corpse) return;
  if (gear.bleedDamage > 0) target.bleedTimer = Math.max(target.bleedTimer, 3.5);
  if (gear.burnDamage > 0) igniteBurnable({ target, x: target.x, y: target.y, targetId: target.id, events });
  if (gear.poisonDamage > 0) inflictPoison(target);
}

export function applyThornsToCreature(opts: {
  readonly targetPlayer: CombatPlayerRef;
  readonly attacker: WildlifeEntity;
  readonly events: WorldEvent[];
}): void {
  const thorns = resolvePlayerGear(opts.targetPlayer).thornsDamage;
  if (thorns <= 0 || opts.attacker.hp <= 0 || opts.attacker.corpse) return;
  opts.attacker.hp = Math.max(0, opts.attacker.hp - thorns);
  opts.attacker.hitTimer = 0.2;
  opts.events.push({
    kind: "hit", x: opts.attacker.x, y: opts.attacker.y, dirX: 0, dirY: 0, value: thorns,
    actorId: opts.targetPlayer.id, targetId: opts.attacker.id, goreStyle: "splatter",
    substance: opts.attacker.substance, fatal: opts.attacker.hp <= 0, entityKind: opts.attacker.kind,
  });
}

function canUseConsumableDef(p: CombatPlayerRef, itemId: string): boolean {
  const def = getItemDef(itemId);
  if (!def || p.combat.actionCooldown > 0 || p.combat.respawnTimer > 0) return false;
  const hasBuff = Boolean(def.buffEffect || def.curesStatuses);
  if (def.wellFedSec || hasBuff) return true;
  return Boolean(def.healHp && p.combat.hp < p.combat.maxHp);
}

function clearPlayerCombatStatuses(c: CombatPlayerRef["combat"]): void {
  c.burnTimer = 0; c.burnTickAcc = 0;
  c.poisonTimer = 0; c.poisonTickAcc = 0; c.poisonLocked = false;
  c.bleedTimer = 0;
}

function applyBuffIfPresent(c: CombatPlayerRef["combat"], buff: NonNullable<ReturnType<typeof getItemDef>>["buffEffect"]): void {
  if (!buff) return;
  c.buffKind = buff.kind;
  c.buffTimer = Math.max(c.buffTimer, buff.durationSec);
}

function applyHealAndFed(c: CombatPlayerRef["combat"], heal: number, fed: number): void {
  if (heal > 0) c.hp = Math.min(c.maxHp, c.hp + heal);
  if (fed > 0) c.wellFedTimer = Math.max(c.wellFedTimer, fed);
}

function applyConsumableDefEffects(p: CombatPlayerRef, itemId: string, events: WorldEvent[]): void {
  const def = getItemDef(itemId);
  if (!def) return;
  const heal = def.healHp || 0;
  const fed = def.wellFedSec || 0;
  applyHealAndFed(p.combat, heal, fed);
  if (def.curesStatuses) clearPlayerCombatStatuses(p.combat);
  applyBuffIfPresent(p.combat, def.buffEffect);
  p.combat.actionCooldown = 0.45;
  events.push({ kind: "heal", x: p.x, y: p.y, value: heal || Math.round(fed / 10) || 1, actorId: p.id });
}

export function useConsumableByItemId(p: CombatPlayerRef, itemId: string, events: WorldEvent[]): boolean {
  if (!canUseConsumableDef(p, itemId) || !consumeItemFromSlots(p.inventory.slots, itemId, 1)) return false;
  applyConsumableDefEffects(p, itemId, events);
  return true;
}

export function useConsumableAtSlot(p: CombatPlayerRef, slotIndex: number, events: WorldEvent[]): boolean {
  const item = p.inventory.slots[slotIndex];
  if (!item || !canUseConsumableDef(p, item.itemId)) return false;
  if (!removeFromSlot(p.inventory.slots, slotIndex, 1)) return false;
  applyConsumableDefEffects(p, item.itemId, events);
  return true;
}
