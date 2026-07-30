import type { ToonVisibilityController } from "../toonVisibilityController.js";
import type { ToonVisibilityMetrics } from "../toonVisibilityController.js";

export interface LightingToonMetrics extends ToonVisibilityMetrics {
  readonly playerGroundLightObjects: number;
}

export function readLightingToonMetrics(
  toon: ToonVisibilityController,
  playerGroundLightObjects: number,
): LightingToonMetrics {
  return { ...toon.metrics(), playerGroundLightObjects };
}
