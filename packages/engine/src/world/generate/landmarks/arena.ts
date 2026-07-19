// Arena landmark (plaza & pillar-forest districts): a flat open ring
// bounded by a standing wall, with the corridor network punching clean
// gates through it — the district's meeting-ground/fighting-pit centerpiece.

import { CHUNK_SIZE, TILE } from "../../types.js";
import { forEachLandmarkTile, landmarkCenter, onCorridor } from "./shared.js";

const WALL_RADIUS = 10;

export function stampArena(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
  corridorCarved: Uint8Array,
  tiles: Uint8Array,
  height: Float32Array,
): void {
  const center = landmarkCenter(worldSeed, floor, cx, cy);
  forEachLandmarkTile(center, WALL_RADIUS, (lx, ly, dx, dy) => {
    const i = ly * CHUNK_SIZE + lx;
    const d = Math.max(Math.abs(dx), Math.abs(dy));
    if (d > WALL_RADIUS) return;
    const carved = onCorridor(corridorCarved, CHUNK_SIZE, lx, ly);
    const isRingWall = d === WALL_RADIUS && !carved;
    tiles[i] = isRingWall ? TILE.Wall : TILE.Floor;
    height[i] = 0;
  });
}
