import { type EffectEvent, type Entity } from "@dc2d/engine";
import { effectTargetFor } from "../core/helpers.js";
import type { SimState } from "../state/state.js";

export interface EntityStatusApplication {
  readonly sim: SimState;
  readonly entity: Entity;
  readonly statusId: string;
  readonly effectEvents: EffectEvent[];
  readonly sourceId?: string;
}

/** Applies an authored status through the authoritative effect system. */
export function applyEntityStatus(input: EntityStatusApplication): boolean {
  const { sim, entity, statusId, effectEvents, sourceId } = input;
  return sim.effects.applyStatus({
    entity,
    statusId,
    events: effectEvents,
    target: effectTargetFor(sim, entity),
    ...sourceOption(sourceId),
  });
}

function sourceOption(sourceId: string | undefined): { sourceId?: string } {
  return sourceId === undefined ? {} : { sourceId };
}
