/** Owns pure terrain refresh thresholds that preserve a visible geometry buffer. */
export interface TerrainOrigin {
  x: number;
  z: number;
}

const MINIMUM_EDGE_BUFFER = 6;

export const terrainRefreshDistance = (viewRadius: number) => Math.max(MINIMUM_EDGE_BUFFER * 2, viewRadius - MINIMUM_EDGE_BUFFER);

export const needsTerrainRefresh = (origin: TerrainOrigin, current: TerrainOrigin, viewRadius: number) => {
  const distance = Math.max(Math.abs(origin.x - current.x), Math.abs(origin.z - current.z));
  return distance > terrainRefreshDistance(viewRadius);
};
