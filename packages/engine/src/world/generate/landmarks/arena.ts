// Arena landmark (plaza & pillar-forest districts): a flat open ring
// bounded by a standing wall, with the corridor network punching clean
// gates through it — the district's meeting-ground/fighting-pit centerpiece.

import { TILE, TOPOLOGY } from "../../types.js";
import { GENERATION_CHUNK_SIZE as CHUNK_SIZE } from "../scale.js";
import { forEachLandmarkTile, landmarkCenter, onCorridor, type LandmarkStamp } from "./shared.js";

const WALL_RADIUS = 10;

export function stampArena({ worldSeed, floor, cx, cy, corridorCarved, tiles, height }: LandmarkStamp): void {
  const center = landmarkCenter({ worldSeed, floor, cx, cy });
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
