import type { LevelId } from "./level.js";

/** Server-selected world-generation features shared with every client. */
export interface WorldFeatures {
  readonly voidTerrain: boolean;
}

export interface WorldOptions {
  readonly level?: LevelId;
  readonly features?: WorldFeatures;
}

/** Preserve the currently shipped world unless startup explicitly disables it. */
export const DEFAULT_WORLD_FEATURES: WorldFeatures = Object.freeze({
  voidTerrain: true,
});

/** Snapshot startup configuration so a generated World cannot change modes mid-cache. */
export function snapshotWorldFeatures(
  features: WorldFeatures = DEFAULT_WORLD_FEATURES,
): WorldFeatures {
  return Object.freeze({ voidTerrain: features.voidTerrain });
}
