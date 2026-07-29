import type { ActiveStatus, Entity } from "../entities/entity.js";
import type { Primitive, StatusDef } from "./types.js";
import type { EffectEvent } from "./events.js";
import { modifyHealth, type EffectTarget } from "./health.js";
import { executePrimitive } from "./primitives/execute.js";
import { inSanctuary, tagsOf, type EffectsState } from "./state.js";

/** True if a status may not be applied to this entity right now (dead, sanctuary, immunity). */
export type StatusApplication = Readonly<{ entity: Entity; statusId: string; events: EffectEvent[]; target?: EffectTarget }>;
export type StatusRemoval = Readonly<{ entity: Entity; tag: string; events: EffectEvent[] }>;
type StatusBlockCheck = Readonly<{ entity: Entity; def: StatusDef; target: EffectTarget }>;

export type PrimitiveRun = Readonly<{ entity: Entity; primitives: readonly Primitive[]; events: EffectEvent[]; target?: EffectTarget; rng?: () => number; sourceTags?: readonly string[] | undefined }>;

function isBlocked(state: EffectsState, check: StatusBlockCheck): boolean {
  const { entity, def, target } = check;
  if (entity.hp <= 0) return true;
  if (def.kind === "debuff" && (inSanctuary(state, entity) || target.invulnerable)) return true;
  if (target.immunities?.some((tag) => def.tags.includes(tag))) return true;
  return false;
}

/** Applies stacking rules to an already-active status; true if it changed. */
function restack(existing: ActiveStatus, def: StatusDef): boolean {
  if (def.stacking === "ignore") return false;
  if (def.stacking === "refresh") {
    existing.remaining = def.duration;
    existing.tickAccum = 0;
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
  request: StatusApplication,
): boolean {
  const { entity, statusId, events, target = {} } = request;
  const def = state.content.statuses.get(statusId);
  if (!def) return false;
  if (isBlocked(state, { entity, def, target })) return false;

  const existing = entity.statuses.find((s) => s.defId === statusId);
  return existing
    ? refreshStatus(state, { entity, def, events, target, existing })
    : addStatus(state, { entity, statusId, def, events, target });
}

type ExistingStatusChange = Readonly<{ entity: Entity; def: StatusDef; events: EffectEvent[]; target: EffectTarget; existing: ActiveStatus }>;

function refreshStatus(state: EffectsState, change: ExistingStatusChange): boolean {
  const { entity, def, events, target, existing } = change;
  const refreshed = restack(existing, def);
  if (refreshed && def.onRefresh) runPrimitives(state, { entity, primitives: def.onRefresh, events, target });
  return refreshed;
}

type NewStatusChange = Readonly<{ entity: Entity; statusId: string; def: StatusDef; events: EffectEvent[]; target: EffectTarget }>;

function addStatus(state: EffectsState, change: NewStatusChange): true {
  const { entity, statusId, def, events, target } = change;
  entity.statuses.push({ defId: statusId, remaining: def.duration, tickAccum: 0, stacks: 1 });
  events.push({ t: "status", id: entity.id, status: statusId, on: true });
  if (def.onApply) runPrimitives(state, { entity, primitives: def.onApply, events, target });
  runInteractionRules(state, { entity, events });
  return true;
}

/** Remove active statuses carrying the given tag. */
export function removeStatusesByTag(
  state: EffectsState,
  request: StatusRemoval,
): void {
  const { entity, tag, events } = request;
  for (let i = entity.statuses.length - 1; i >= 0; i--) {
    const status = entity.statuses[i];
    if (!status) continue;
    const def = state.content.statuses.get(status.defId);
    if (statusMatchesTag(def, tag)) {
      entity.statuses.splice(i, 1);
      events.push({ t: "status", id: entity.id, status: status.defId, on: false });
    }
  }
}

function statusMatchesTag(def: StatusDef | undefined, tag: string): boolean {
  return def?.tags.includes(tag) === true || def?.appliesTags?.includes(tag) === true;
}

/**
 * Tag interaction rules (fire + wet ⇒ extinguish…): evaluated to a
 * bounded fixpoint whenever tags may have changed.
 */
export function runInteractionRules(
  state: EffectsState,
  request: Pick<StatusRemoval, "entity" | "events">,
): void {
  const { entity, events } = request;
  for (let pass = 0; pass < 4; pass++) {
    if (!applyInteractionPass(state, { entity, events })) return;
  }
}

function applyInteractionPass(state: EffectsState, request: Pick<StatusRemoval, "entity" | "events">): boolean {
  const { entity, events } = request;
  const tags = tagsOf(state, entity);
  let changed = false;
  for (const rule of state.content.rules) {
    if (applyMatchingRule(state, { entity, events, tags, rule })) changed = true;
  }
  return changed;
}

type RuleApplication = Readonly<{ entity: Entity; events: EffectEvent[]; tags: Set<string>; rule: EffectsState["content"]["rules"][number] }>;

function applyMatchingRule(state: EffectsState, application: RuleApplication): boolean {
  const { entity, events, tags, rule } = application;
  if (!tags.has(rule.when[0]) || !tags.has(rule.when[1])) return false;
  const removed = removeRuleTags(state, { entity, events, tags: rule.removeTags });
  return applyRuleStatus(state, { entity, statusId: rule.apply, events }) || removed;
}

function removeRuleTags(
  state: EffectsState,
  request: Pick<StatusRemoval, "entity" | "events"> & { readonly tags?: readonly string[] | undefined },
): boolean {
  if (!request.tags) return false;
  for (const tag of request.tags) removeStatusesByTag(state, { ...request, tag });
  return true;
}

function applyRuleStatus(
  state: EffectsState,
  request: Pick<StatusApplication, "entity" | "events"> & { readonly statusId?: string | undefined },
): boolean {
  const { entity, statusId, events } = request;
  if (!statusId) return false;
  // Avoid infinite loops: rules never re-apply a status already present.
  if (entity.statuses.some((s) => s.defId === statusId)) return false;
  return applyStatus(state, { entity, statusId, events });
}

/**
 * Execute event-like primitives against an entity. spawn_area is
 * emitted as an event for the sim to realize (the engine has no
 * world-mutation authority of its own).
 */
export function runPrimitives(
  state: EffectsState,
  request: PrimitiveRun,
): void {
  const { entity, primitives, events, target = {}, rng = Math.random, sourceTags } = request;
  for (const p of primitives) {
    executePrimitive(
      { entity, primitive: p, events, target, rng, sourceTags },
      {
        modifyHealth: (change) => modifyHealth(state, change),
        applyStatus: (change) => applyStatus(state, change),
        removeStatusesByTag: (removal) => removeStatusesByTag(state, removal),
      },
    );
    if (entity.hp <= 0) return;
  }
}
