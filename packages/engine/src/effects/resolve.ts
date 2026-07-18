import type { ActiveStatus, Entity } from "../entities/entity.js";
import type { Primitive, StatusDef } from "./types.js";
import type { EffectEvent } from "./events.js";
import { modifyHealth, type EffectTarget } from "./health.js";
import { inSanctuary, tagsOf, type EffectsState } from "./state.js";

/** True if a status may not be applied to this entity right now (dead, sanctuary, immunity). */
function isBlocked(state: EffectsState, entity: Entity, def: StatusDef, target: EffectTarget): boolean {
  if (entity.hp <= 0) return true;
  if (def.kind === "debuff" && inSanctuary(state, entity)) return true;
  if (target.immunities?.some((tag) => def.tags.includes(tag))) return true;
  return false;
}

/** Applies stacking rules to an already-active status; true if it changed. */
function restack(existing: ActiveStatus, def: StatusDef): boolean {
  if (def.stacking === "ignore") return false;
  if (def.stacking === "refresh") {
    existing.remaining = def.duration;
    return true;
  }
  // stack
  if (existing.stacks >= (def.maxStacks ?? 3)) return false;
  existing.stacks++;
  existing.remaining = def.duration;
  return true;
}

/**
 * Status application, removal, and the tag interaction rules — kept in
 * one module because they recurse into each other (onApply primitives
 * can apply further statuses; applying a status re-evaluates rules).
 */

/**
 * Apply a status by id. Respects immunities (by status tag), stacking
 * rules, and sanctuary (debuffs are suppressed inside). Runs onApply
 * primitives and then the tag interaction rules.
 */
export function applyStatus(
  state: EffectsState,
  entity: Entity,
  statusId: string,
  events: EffectEvent[],
  target: EffectTarget = {},
): boolean {
  const def = state.content.statuses.get(statusId);
  if (!def) return false;
  if (isBlocked(state, entity, def, target)) return false;

  const existing = entity.statuses.find((s) => s.defId === statusId);
  if (existing) return restack(existing, def);

  entity.statuses.push({ defId: statusId, remaining: def.duration, tickAccum: 0, stacks: 1 });
  events.push({ t: "status", id: entity.id, status: statusId, on: true });
  if (def.onApply) runPrimitives(state, entity, def.onApply, events, target);
  runInteractionRules(state, entity, events);
  return true;
}

/** Remove active statuses carrying the given tag. */
export function removeStatusesByTag(
  state: EffectsState,
  entity: Entity,
  tag: string,
  events: EffectEvent[],
): void {
  for (let i = entity.statuses.length - 1; i >= 0; i--) {
    const status = entity.statuses[i];
    if (!status) continue;
    const def = state.content.statuses.get(status.defId);
    if (def && (def.tags.includes(tag) || def.appliesTags?.includes(tag))) {
      entity.statuses.splice(i, 1);
      events.push({ t: "status", id: entity.id, status: status.defId, on: false });
    }
  }
}

/**
 * Tag interaction rules (fire + wet ⇒ extinguish…): evaluated to a
 * bounded fixpoint whenever tags may have changed.
 */
export function runInteractionRules(state: EffectsState, entity: Entity, events: EffectEvent[]): void {
  for (let pass = 0; pass < 4; pass++) {
    const tags = tagsOf(state, entity);
    let changed = false;
    for (const rule of state.content.rules) {
      if (!tags.has(rule.when[0]) || !tags.has(rule.when[1])) continue;
      if (rule.removeTags) {
        for (const tag of rule.removeTags) removeStatusesByTag(state, entity, tag, events);
        changed = true;
      }
      if (rule.apply) changed = applyRuleStatus(state, entity, rule.apply, events) || changed;
    }
    if (!changed) return;
  }
}

function applyRuleStatus(state: EffectsState, entity: Entity, statusId: string, events: EffectEvent[]): boolean {
  // Avoid infinite loops: rules never re-apply a status already present.
  if (entity.statuses.some((s) => s.defId === statusId)) return false;
  return applyStatus(state, entity, statusId, events);
}

/**
 * Execute event-like primitives against an entity. spawn_area is
 * emitted as an event for the sim to realize (the engine has no
 * world-mutation authority of its own).
 */
export function runPrimitives(
  state: EffectsState,
  entity: Entity,
  primitives: readonly Primitive[],
  events: EffectEvent[],
  target: EffectTarget = {},
  rng: () => number = Math.random,
  sourceTags?: readonly string[],
): void {
  for (const p of primitives) {
    runPrimitive(state, entity, p, events, target, rng, sourceTags);
    if (entity.hp <= 0) return;
  }
}

function runPrimitive(
  state: EffectsState,
  entity: Entity,
  p: Primitive,
  events: EffectEvent[],
  target: EffectTarget,
  rng: () => number,
  sourceTags?: readonly string[],
): void {
  switch (p.primitive) {
    case "modify_health":
      modifyHealth(state, entity, p.amount, events, sourceTags ? { sourceTags } : {}, target);
      break;
    case "apply_status":
      if (p.chance === undefined || rng() < p.chance) applyStatus(state, entity, p.status, events, target);
      break;
    case "remove_status":
      removeStatusesByTag(state, entity, p.tag, events);
      break;
    case "spawn_area":
      events.push({
        t: "spawnArea",
        x: Math.floor(entity.body.x),
        y: Math.floor(entity.body.y),
        area: p.area,
        radius: p.radius,
      });
      break;
    case "destroy_entity":
      events.push({ t: "destroy", id: entity.id });
      break;
    case "modify_stat":
      break; // continuous — read via speedMult(), not executed
  }
}
