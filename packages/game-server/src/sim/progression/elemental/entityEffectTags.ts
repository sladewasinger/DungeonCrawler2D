import type { Entity } from "@dc2d/engine";
import type { SimState } from "../../state/state.js";

/**
 * Matches either an effective entity tag or a tag classifying an active status.
 * Status definition tags describe the effect itself; appliesTags describe traits
 * granted to the affected entity.
 */
export function entityHasEffectTag(
  sim: SimState,
  entity: Entity,
  tag: string,
): boolean {
  if (sim.effects.tagsOf(entity).has(tag)) return true;
  return entity.statuses.some((status) =>
    sim.content.statuses.get(status.defId)?.tags.includes(tag) ?? false
  );
}
