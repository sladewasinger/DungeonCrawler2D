/** Owns pure terrain refresh thresholds that preserve a visible geometry buffer. */
import { isViewDistance, type ViewDistance } from "./viewDistance.js";
import { environmentProfile } from "./threeEnvironment.js";

export interface TerrainOrigin {
  x: number;
  z: number;
}

export const terrainRefreshDistance = (viewRadius: number): number =>
  isViewDistance(viewRadius)
    ? environmentProfile(viewRadius as ViewDistance).terrainRefreshDistance
    : Math.max(2, Math.floor(viewRadius / 8));

export const needsTerrainRefresh = (origin: TerrainOrigin, current: TerrainOrigin, viewRadius: number) => {
  const distance = Math.max(Math.abs(origin.x - current.x), Math.abs(origin.z - current.z));
  return distance > terrainRefreshDistance(viewRadius);
};
