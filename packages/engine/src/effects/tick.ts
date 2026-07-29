import type { ActiveStatus, Entity } from "../entities/entity.js";
import type { StatusDef } from "./types.js";
import type { EffectEvent } from "./events.js";
import type { EffectTarget } from "./health.js";
import { runPrimitives } from "./resolve.js";
import type { EffectsState } from "./state.js";

const STATUS_TIME_EPSILON = 1e-9;

/** Fires onTick primitives as many times as tickAccum allows; true if the entity died from it. */
interface TickContext {
  readonly entity: Entity;
  readonly status: ActiveStatus;
  readonly def: StatusDef;
  readonly dt: number;
  readonly events: EffectEvent[];
  readonly target: EffectTarget;
  readonly rng: () => number;
}

function advanceTicking(state: EffectsState, context: TickContext): boolean {
  const { entity, status, def, dt } = context;
  if (!def.onTick || !def.tickEvery) return false;
  status.tickAccum += dt;
  while (status.tickAccum >= def.tickEvery) {
    status.tickAccum -= def.tickEvery;
    runStatusTick(state, context);
    if (entity.hp <= 0) return true; // died to a tick; stop processing
  }
  return false;
}

function runStatusTick(state: EffectsState, context: TickContext): void {
  const { entity, status, def, events, target, rng } = context;
  if (!def.onTick) return;
  for (let stack = 0; stack < status.stacks; stack++) {
    runPrimitives(state, { entity, primitives: def.onTick, events, target, rng, sourceTags: def.tags });
  }
}

/** Counts down remaining duration and expires the status (splice + onExpire) once it hits zero. */
interface ExpiryContext extends TickContext {
  readonly index: number;
}

function advanceExpiry(state: EffectsState, context: ExpiryContext): void {
  const { entity, status, def, dt, index, events, target } = context;
  if (status.remaining === null) return;
  status.remaining -= dt;
  if (status.remaining > STATUS_TIME_EPSILON) return;
  entity.statuses.splice(index, 1);
  events.push({ t: "status", id: entity.id, status: status.defId, on: false });
  if (def.onExpire) runPrimitives(state, { entity, primitives: def.onExpire, events, target });
}

/** Advance all statuses on an entity by dt seconds. */
export interface EffectsTick {
  readonly entity: Entity;
  readonly dt: number;
  readonly events: EffectEvent[];
  readonly target?: EffectTarget;
  readonly rng?: () => number;
}

export function tick(state: EffectsState, request: EffectsTick): void {
  const { entity, dt, events, target = {}, rng = Math.random } = request;
  for (let i = entity.statuses.length - 1; i >= 0; i--) {
    if (advanceStatus(state, { entity, status: entity.statuses[i], index: i, dt, events, target, rng })) return;
  }
}

interface StatusAdvance {
  readonly entity: Entity;
  readonly status: ActiveStatus | undefined;
  readonly index: number;
  readonly dt: number;
  readonly events: EffectEvent[];
  readonly target: EffectTarget;
  readonly rng: () => number;
}

function advanceStatus(state: EffectsState, request: StatusAdvance): boolean {
  const { entity, status, index, dt, events, target, rng } = request;
  if (!status) return false;
  const def = state.content.statuses.get(status.defId);
  if (!def) return removeUnknownStatus(entity, index);
  const context = { entity, status, def, dt: activeDuration(status, dt), events, target, rng };
  if (advanceTicking(state, context)) return true;
  advanceExpiry(state, { ...context, dt, index });
  return false;
}

function activeDuration(status: ActiveStatus, dt: number): number {
  return status.remaining === null ? dt : Math.min(dt, Math.max(0, status.remaining));
}

function removeUnknownStatus(entity: Entity, index: number): false {
  entity.statuses.splice(index, 1);
  return false;
}

/** Combined speed multiplier from whileActive modify_stat primitives. */
export function speedMult(state: EffectsState, entity: Entity): number {
  let mult = 1;
  for (const status of entity.statuses) {
    mult *= speedMultForStatus(state, status);
  }
  return mult;
}

function speedMultForStatus(state: EffectsState, status: ActiveStatus): number {
  const primitives = state.content.statuses.get(status.defId)?.whileActive ?? [];
  return primitives.reduce((mult, primitive) => {
    if (primitive.primitive !== "modify_stat" || primitive.stat !== "speed") return mult;
    return mult * primitive.mult;
  }, 1);
}
