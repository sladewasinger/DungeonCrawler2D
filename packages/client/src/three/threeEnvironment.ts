/** Deterministic renderer budgets for each user-selectable view distance. */
import type { ViewDistance } from "./viewDistance.js";

export interface ThreeEnvironmentProfile {
  fogNear: number;
  fogFar: number;
  terrainRefreshDistance: number;
  maxSconceLights: number;
  ambientMotes: number;
  maxPixelRatio: number;
}

const PROFILES: Record<ViewDistance, ThreeEnvironmentProfile> = {
  18: {
    fogNear: 8,
    fogFar: 15,
    terrainRefreshDistance: 2,
    maxSconceLights: 4,
    ambientMotes: 32,
    maxPixelRatio: 1.25,
  },
  26: {
    fogNear: 11,
    fogFar: 22,
    terrainRefreshDistance: 3,
    maxSconceLights: 6,
    ambientMotes: 48,
    maxPixelRatio: 1.5,
  },
  34: {
    fogNear: 14,
    fogFar: 29,
    terrainRefreshDistance: 4,
    maxSconceLights: 8,
    ambientMotes: 64,
    maxPixelRatio: 1.5,
  },
};

export const environmentProfile = (
  distance: ViewDistance,
): ThreeEnvironmentProfile => PROFILES[distance];

export const geometryRemainsFogged = (distance: ViewDistance): boolean => {
  const profile = environmentProfile(distance);
  return distance - profile.terrainRefreshDistance >= profile.fogFar;
};
