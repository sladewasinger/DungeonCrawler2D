// Shrine landmark (warren district): a small raised dais in an open
// courtyard, ringed by a low wall with gates wherever the corridor network
// crosses it — an intimate plaza at the super-chunk's heart.

import { TILE, TOPOLOGY } from "../../types.js";
import { GENERATION_CHUNK_SIZE as CHUNK_SIZE } from "../scale.js";
import { forEachLandmarkTile, landmarkCenter, onCorridor, type LandmarkStamp } from "./shared.js";

const DAIS_RADIUS = 4;
const RING_RADIUS = 6;
// A small decorative bump beside the corridor's own flush passthrough
// (see `carved` below) — never load-bearing for reachability, so it
// simply halves with the z-scale doctrine, no ramp needed.
export const DAIS_HEIGHT = 0.5;

export function stampShrine({ worldSeed, floor, cx, cy, corridorCarved, tiles, height }: LandmarkStamp): void {
  const center = landmarkCenter({ worldSeed, floor, cx, cy });
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
