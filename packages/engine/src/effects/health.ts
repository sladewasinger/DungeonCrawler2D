import type { Entity } from "../entities/entity.js";
import type { EffectEvent } from "./events.js";
import { inSanctuary, type EffectsState } from "./state.js";

export interface DamageOpts {
  /** Tags describing the damage source (fire, physical, …). */
  sourceTags?: readonly string[];
  /** Sanctuary suppression bypass (falls, bleed-out — world rules). */
  ignoreSanctuary?: boolean;
}

export interface EffectTarget {
  /** Immunity tags from the entity's content definition. */
  immunities?: readonly string[];
  /** Damage multipliers by source tag. */
  damageScale?: Readonly<Record<string, number>>;
}

/** Scales a hostile amount by the target's per-tag damageScale, or returns it unchanged. */
function scaleDamage(
  amount: number,
  sourceTags: readonly string[] | undefined,
  damageScale: Readonly<Record<string, number>> | undefined,
): number {
  if (!damageScale || !sourceTags) return amount;
  let delta = amount;
  for (const tag of sourceTags) {
    const scale = damageScale[tag];
    if (scale !== undefined) delta *= scale;
  }
  return delta;
}

/** Resolves the final delta for a health change, or null if sanctuary suppresses it. */
function resolveDelta(
  state: EffectsState,
  entity: Entity,
  amount: number,
  opts: DamageOpts,
  target: EffectTarget,
): number | null {
  if (amount >= 0) return amount;
  if (!opts.ignoreSanctuary && inSanctuary(state, entity)) return null;
  return scaleDamage(amount, opts.sourceTags, target.damageScale);
}

/**
 * Damage/heal an entity. Hostile amounts are suppressed in sanctuary
 * and scaled by the target's damageScale per source tag. Emits hp
 * and death events. Returns the applied delta.
 */
export function modifyHealth(
  state: EffectsState,
  entity: Entity,
  amount: number,
  events: EffectEvent[],
  opts: DamageOpts = {},
  target: EffectTarget = {},
): number {
  if (entity.hp <= 0) return 0;
  const delta = resolveDelta(state, entity, amount, opts, target);
  if (delta === null) return 0;
  const before = entity.hp;
  entity.hp = Math.max(0, Math.min(entity.maxHp, entity.hp + delta));
  const applied = entity.hp - before;
  if (applied !== 0) events.push({ t: "hp", id: entity.id, delta: applied, hp: entity.hp });
  if (entity.hp <= 0) events.push({ t: "death", id: entity.id });
  return applied;
}
