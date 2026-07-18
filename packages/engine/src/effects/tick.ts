import type { ActiveStatus, Entity } from "../entities/entity.js";
import type { StatusDef } from "./types.js";
import type { EffectEvent } from "./events.js";
import type { EffectTarget } from "./health.js";
import { runPrimitives } from "./resolve.js";
import type { EffectsState } from "./state.js";

/** Fires onTick primitives as many times as tickAccum allows; true if the entity died from it. */
function advanceTicking(
  state: EffectsState,
  entity: Entity,
  status: ActiveStatus,
  def: StatusDef,
  dt: number,
  events: EffectEvent[],
  target: EffectTarget,
  rng: () => number,
): boolean {
  if (!def.onTick || !def.tickEvery) return false;
  status.tickAccum += dt;
  while (status.tickAccum >= def.tickEvery) {
    status.tickAccum -= def.tickEvery;
    for (let s = 0; s < status.stacks; s++) {
      // A status's own tags describe the damage source: fire-
      // tagged ticks burn flammable targets harder (damageScale).
      runPrimitives(state, entity, def.onTick, events, target, rng, def.tags);
    }
    if (entity.hp <= 0) return true; // died to a tick; stop processing
  }
  return false;
}

/** Counts down remaining duration and expires the status (splice + onExpire) once it hits zero. */
function advanceExpiry(
  state: EffectsState,
  entity: Entity,
  status: ActiveStatus,
  def: StatusDef,
  dt: number,
  index: number,
  events: EffectEvent[],
  target: EffectTarget,
): void {
  if (status.remaining === null) return;
  status.remaining -= dt;
  if (status.remaining > 0) return;
  entity.statuses.splice(index, 1);
  events.push({ t: "status", id: entity.id, status: status.defId, on: false });
  if (def.onExpire) runPrimitives(state, entity, def.onExpire, events, target);
}

/** Advance all statuses on an entity by dt seconds. */
export function tick(
  state: EffectsState,
  entity: Entity,
  dt: number,
  events: EffectEvent[],
  target: EffectTarget = {},
  rng: () => number = Math.random,
): void {
  for (let i = entity.statuses.length - 1; i >= 0; i--) {
    const status = entity.statuses[i];
    if (!status) continue;
    const def = state.content.statuses.get(status.defId);
    if (!def) {
      entity.statuses.splice(i, 1);
      continue;
    }
    if (advanceTicking(state, entity, status, def, dt, events, target, rng)) return;
    advanceExpiry(state, entity, status, def, dt, i, events, target);
  }
}

/** Combined speed multiplier from whileActive modify_stat primitives. */
export function speedMult(state: EffectsState, entity: Entity): number {
  let mult = 1;
  for (const status of entity.statuses) {
    const def = state.content.statuses.get(status.defId);
    if (!def?.whileActive) continue;
    for (const p of def.whileActive) {
      if (p.primitive === "modify_stat" && p.stat === "speed") mult *= p.mult;
    }
  }
  return mult;
}
