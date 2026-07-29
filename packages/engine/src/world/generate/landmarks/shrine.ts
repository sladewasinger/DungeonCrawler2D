// Shrine landmark (warren district): a small raised dais in an open
// courtyard, ringed by a low wall with gates wherever the corridor network
// crosses it — an intimate plaza at the district's heart.

import { CHUNK_SIZE, TILE, TOPOLOGY } from "../../core/types.js";
import { WORLD_GENERATION_TUNING } from "../tuning.js";
import { forEachLandmarkTile, landmarkCenter, onCorridor, type LandmarkStamp } from "./shared.js";

const DAIS_RADIUS = WORLD_GENERATION_TUNING.landmarks.shrineDaisRadius;
const RING_RADIUS = WORLD_GENERATION_TUNING.landmarks.shrineRingRadius;
// A small decorative bump beside the corridor's own flush passthrough
// (see `carved` below) — never load-bearing for reachability, so it
// simply halves with the z-scale doctrine, no ramp needed.
export const DAIS_HEIGHT =
  WORLD_GENERATION_TUNING.landmarks.shrineDaisHeight;

export function stampShrine({ worldSeed, floor, cx, cy, corridorCarved, tiles, height }: LandmarkStamp): void {
  const center = landmarkCenter({ worldSeed, floor, cx, cy }, RING_RADIUS);
  forEachLandmarkTile(center, RING_RADIUS, (tile) => stampShrineTile({ corridorCarved, tiles, height, tile }));
}

function stampShrineTile({ corridorCarved, tiles, height, tile }: { corridorCarved: Uint8Array; tiles: Uint8Array; height: Float32Array; tile: { lx: number; ly: number; dx: number; dy: number } }): void {
  const { lx, ly, dx, dy } = tile;
  const index = ly * CHUNK_SIZE + lx;
  const distance = Math.max(Math.abs(dx), Math.abs(dy));
  const carved = onCorridor({ corridorCarved, chunkSize: CHUNK_SIZE, lx, ly });
  if (distance <= DAIS_RADIUS) setShrineDais({ tiles, height, index, carved });
  else if (distance < RING_RADIUS) setShrineFloor({ tiles, height, index });
  else if (distance === RING_RADIUS && !carved) setShrineWall({ tiles, height, index });
}

function setShrineDais({ tiles, height, index, carved }: { tiles: Uint8Array; height: Float32Array; index: number; carved: boolean }): void {
  tiles[index] = TILE.Floor;
  height[index] = carved ? 0 : DAIS_HEIGHT;
}

function setShrineFloor({ tiles, height, index }: { tiles: Uint8Array; height: Float32Array; index: number }): void {
  tiles[index] = TILE.Floor;
  height[index] = 0;
}

function setShrineWall({ tiles, height, index }: { tiles: Uint8Array; height: Float32Array; index: number }): void {
  tiles[index] = TOPOLOGY.Uncarved;
  height[index] = 0;
}
