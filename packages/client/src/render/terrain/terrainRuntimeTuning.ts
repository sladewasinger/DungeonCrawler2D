import terrainRuntimeTuning from "./terrainRuntimeTuning.json" with { type: "json" };

/** Memory-retention limits for the live terrain renderer. */
export const TERRAIN_RUNTIME_TUNING = {
  retention: {
    maxChunkPlans: positiveInteger(
      terrainRuntimeTuning.retention.maxChunkPlans,
      "maxChunkPlans",
    ),
    maxOrientationRoots: minimumInteger(
      terrainRuntimeTuning.retention.maxOrientationRoots,
      2,
      "maxOrientationRoots",
    ),
    maxWorldChunks: positiveInteger(
      terrainRuntimeTuning.retention.maxWorldChunks,
      "maxWorldChunks",
    ),
  },
} as const;

function positiveInteger(value: number, name: string): number {
  return minimumInteger(value, 1, name);
}

function minimumInteger(value: number, minimum: number, name: string): number {
  if (Number.isInteger(value) && value >= minimum) return value;
  throw new Error(`Terrain runtime ${name} must be an integer >= ${minimum}`);
}
