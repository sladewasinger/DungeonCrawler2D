import type { Entity } from "../entities/entity.js";
import type { EffectEvent } from "./events.js";
import { inSanctuary, type EffectsState } from "./state.js";

export interface DamageOpts {
  /** Tags describing the damage source (fire, physical, …). */
  sourceTags?: readonly string[];
  /** Sanctuary suppression bypass (falls, bleed-out — world rules). */
  ignoreSanctuary?: boolean;
  /** Presentation source for non-hostile health changes. */
  healthSource?: "automatic";
}

export interface EffectTarget {
  /** Immunity tags from the entity's content definition. */
  immunities?: readonly string[];
  /** Damage multipliers by source tag. */
  damageScale?: Readonly<Record<string, number>>;
  /** Uniform multiplier for hostile health damage, independent of source tags. */
  damageTakenMultiplier?: number;
  /** Full hostile suppression (spawn grace): damage and debuffs are
   * dropped outright — heals and buffs still land. The server sim
   * decides who is protected (game-server sim/spawnSafety.ts). */
  invulnerable?: boolean;
}

/** Input for one authoritative health mutation. */
export interface HealthChange {
  readonly entity: Entity;
  readonly amount: number;
  readonly events: EffectEvent[];
  readonly opts?: DamageOpts;
  readonly target?: EffectTarget;
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
function resolveDelta(state: EffectsState, change: HealthChange): number | null {
  const { entity, amount, opts = {}, target = {} } = change;
  if (amount >= 0) return amount;
  if (target.invulnerable) return null;
  if (!opts.ignoreSanctuary && inSanctuary(state, entity)) return null;
  const scaled = scaleDamage(amount, opts.sourceTags, target.damageScale);
  return scaled * (target.damageTakenMultiplier ?? 1);
}

function emitHealthEvents(change: HealthChange, applied: number): void {
  const { entity, events, opts = {} } = change;
  if (applied !== 0) {
    events.push({
      t: "hp",
      id: entity.id,
      delta: applied,
      hp: entity.hp,
      ...(opts.healthSource === undefined ? {} : { source: opts.healthSource }),
    });
  }
  if (entity.hp <= 0) events.push({ t: "death", id: entity.id });
}

/**
 * Damage/heal an entity. Hostile amounts are suppressed in sanctuary
 * and scaled by the target's damageScale per source tag or uniform
 * damageTakenMultiplier. Emits hp and death events. Returns the applied delta.
 */
export function modifyHealth(
  state: EffectsState,
  change: HealthChange,
): number {
  const { entity } = change;
  if (entity.hp <= 0) return 0;
  const delta = resolveDelta(state, change);
  if (delta === null) return 0;
  const before = entity.hp;
  entity.hp = Math.max(0, Math.min(entity.maxHp, entity.hp + delta));
  const applied = entity.hp - before;
  emitHealthEvents(change, applied);
  return applied;
}
