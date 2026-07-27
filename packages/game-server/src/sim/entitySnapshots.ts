import type { Entity, EntitySnapshot } from "@dc2d/engine";
import { snapshotMatches } from "./snapshotFields/entitySnapshotMatching.js";
import { toEntitySnapshot } from "./snapshotFields/entitySnapshotFields.js";
import type { SimState } from "./state.js";

/** Materializes entity payloads only when their replicated fields change. */
export interface VersionedEntitySnapshot {
  revision: number;
  snapshot: EntitySnapshot;
}

/** Returns the cached payload or replaces it with a new monotonic revision. */
export function versionedEntitySnapshot(sim: SimState, entity: Entity): VersionedEntitySnapshot {
  const cached = sim.snapshotEntities.get(entity.id);
  if (cached && snapshotMatches(sim, entity, cached.snapshot)) return cached;
  const next = {
    revision: (cached?.revision ?? 0) + 1,
    snapshot: toEntitySnapshot(sim, entity),
  };
  sim.snapshotEntities.set(entity.id, next);
  return next;
}
