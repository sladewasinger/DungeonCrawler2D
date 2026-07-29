import type { EffectEvent, Entity } from "@dc2d/engine";
import type { SimState } from "../../state/state.js";
import { entityHasEffectTag } from "./entityEffectTags.js";
import { igniteEntity } from "./elementalIgnition.js";

const DEFAULT_FIRE_AREA_ID = "area-fire";
const DEFAULT_FUEL_TAG = "flammable";
const BURNING_TAG = "burning";
const FIRE_TAG = "fire";

export interface FireContactSource {
  readonly tags: ReadonlySet<string>;
  readonly sourceId?: string;
}

export type FireContactTarget =
  | { readonly kind: "area"; readonly x: number; readonly y: number }
  | { readonly kind: "entity"; readonly entity: Entity };

export interface FireContactRequest {
  readonly sim: SimState;
  readonly source: FireContactSource;
  readonly target: FireContactTarget;
  readonly effectEvents: EffectEvent[];
  readonly fireAreaId?: string;
  readonly fuelTag?: string;
}

/** Resolves one authoritative fire/fuel contact without applying damage. */
export function resolveFireContact(request: FireContactRequest): boolean {
  if (!isFireBearing(request.source)) return false;
  if (request.target.kind === "area") return igniteFuelArea(request);
  return igniteOiledEntity(request);
}

/** Builds a fire source from an entity's active fire status attribution. */
export function fireSourceForEntity(
  sim: SimState,
  entity: Entity,
): FireContactSource | undefined {
  const tags = sim.effects.tagsOf(entity);
  if (!tags.has(BURNING_TAG) && !tags.has(FIRE_TAG)) return undefined;
  const sourceId = fireStatusSourceId(sim, entity);
  return sourceId === undefined ? { tags } : { tags, sourceId };
}

function isFireBearing(source: FireContactSource): boolean {
  return source.tags.has(FIRE_TAG) || source.tags.has(BURNING_TAG);
}

function igniteFuelArea(request: FireContactRequest): boolean {
  const target = request.target;
  if (target.kind !== "area") return false;
  return request.sim.areas.igniteFuelAt({
    fireDefId: request.fireAreaId ?? DEFAULT_FIRE_AREA_ID,
    fuelTag: request.fuelTag ?? DEFAULT_FUEL_TAG,
    x: target.x,
    y: target.y,
    ...(request.source.sourceId === undefined
      ? {}
      : { sourceId: request.source.sourceId }),
  });
}

function igniteOiledEntity(request: FireContactRequest): boolean {
  const target = request.target;
  if (target.kind !== "entity") return false;
  if (!entityHasEffectTag(request.sim, target.entity, "oil")) return false;
  return igniteEntity({
    sim: request.sim,
    entity: target.entity,
    effectEvents: request.effectEvents,
    ...(request.source.sourceId === undefined
      ? {}
      : { sourceId: request.source.sourceId }),
  });
}

function fireStatusSourceId(sim: SimState, entity: Entity): string | undefined {
  for (const status of entity.statuses) {
    const def = sim.content.statuses.get(status.defId);
    if (def?.tags.includes(BURNING_TAG) || def?.appliesTags?.includes(BURNING_TAG)) {
      return status.sourceId;
    }
  }
  return undefined;
}
