// Arena landmark (plaza & pillar-forest districts): a flat open ring
// bounded by a standing wall, with the corridor network punching clean
// gates through it — the district's meeting-ground/fighting-pit centerpiece.

import { CHUNK_SIZE, TILE, TOPOLOGY } from "../../core/types.js";
import { WORLD_GENERATION_TUNING } from "../tuning.js";
import { forEachLandmarkTile, landmarkCenter, onCorridor, type LandmarkStamp } from "./shared.js";

const WALL_RADIUS = WORLD_GENERATION_TUNING.landmarks.arenaWallRadius;

export function stampArena({ worldSeed, floor, cx, cy, corridorCarved, tiles, height }: LandmarkStamp): void {
  const center = landmarkCenter({ worldSeed, floor, cx, cy }, WALL_RADIUS);
  forEachLandmarkTile(center, WALL_RADIUS, ({ lx, ly, dx, dy }) => {
    const i = ly * CHUNK_SIZE + lx;
    const d = Math.max(Math.abs(dx), Math.abs(dy));
    if (d > WALL_RADIUS) return;
    const carved = onCorridor({ corridorCarved, chunkSize: CHUNK_SIZE, lx, ly });
    const isRingWall = d === WALL_RADIUS && !carved;
    tiles[i] = isRingWall ? TOPOLOGY.Uncarved : TILE.Floor;
    height[i] = 0;
  });
}
