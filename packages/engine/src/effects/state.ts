import { entityTags, type Entity } from "../entities/entity.js";
import type { ContentRegistry } from "./types.js";

/**
 * Shared read-only state the effects engine's sibling modules operate
 * on: the content registry (statuses, rules) plus the sanctuary
 * predicate injected by the sim (the engine owns no world geometry).
 */
export interface EffectsState {
  readonly content: ContentRegistry;
  readonly isSanctuaryAt: (x: number, y: number) => boolean;
}

/**
 * All tags currently on an entity: base tags + tags applied by active
 * statuses + the derived `airborne` tag.
 */
export function tagsOf(state: EffectsState, entity: Entity): Set<string> {
  return entityTags(entity, (defId) => state.content.statuses.get(defId)?.appliesTags);
}

/** Whether an entity's current position sits inside a sanctuary zone. */
export function inSanctuary(state: EffectsState, entity: Entity): boolean {
  return state.isSanctuaryAt(Math.floor(entity.body.x), Math.floor(entity.body.y));
}
