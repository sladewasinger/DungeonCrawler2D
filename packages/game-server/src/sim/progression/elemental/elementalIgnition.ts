import type { EffectEvent, Entity } from "@dc2d/engine";
import { effectTargetFor } from "../../core/helpers.js";
import type { SimState } from "../../state/state.js";
import { entityHasEffectTag } from "./entityEffectTags.js";

const DEFAULT_BURNING_STATUS_ID = "on-fire";

export interface ElementalIgnition {
  readonly sim: SimState;
  readonly entity: Entity;
  readonly effectEvents: EffectEvent[];
  readonly statusId?: string;
  readonly sourceId?: string;
}

/**
 * Consumes oil and starts one bounded burn. Repeated flame contacts do not
 * refresh an existing burn, so one accepted ignition has one fixed duration.
 */
export function igniteEntity(input: ElementalIgnition): boolean {
  const {
    sim,
    entity,
    effectEvents,
    statusId = DEFAULT_BURNING_STATUS_ID,
    sourceId,
  } = input;
  const alreadyBurning = entityHasEffectTag(sim, entity, "burning");
  if (entityHasEffectTag(sim, entity, "oil")) {
    sim.effects.removeStatusesByTag({
      entity,
      tag: "oil",
      events: effectEvents,
    });
  }
  if (alreadyBurning) return false;
  return sim.effects.applyStatus({
    entity,
    statusId,
    events: effectEvents,
    target: effectTargetFor(sim, entity),
    ...(sourceId === undefined ? {} : { sourceId }),
  });
}
