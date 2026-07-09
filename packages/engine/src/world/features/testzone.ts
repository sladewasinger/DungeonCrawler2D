import { WALL_RISE } from "../../core/constants";
import { CHUNK_SIZE, TILE, ZONE, type Chunk, type TileType } from "../types";

export const SANDBOX_MIN_CHUNK = 0;
export const SANDBOX_MAX_CHUNK = 1;
export const SANDBOX_SPAWN = { x: 28.5, y: 28.5 };

const SANDBOX_WALL_HEIGHT = WALL_RISE + 4;

interface Sample {
  tile: TileType;
  height: number;
  zone: number;
}

function sampleAt(x: number, y: number): Sample {
  let height = 0;
  let tile: TileType = TILE.Floor;
  let zone = ZONE.None;

  const hillDistance = Math.max(Math.abs(x - 14), Math.abs(y - 14));
  if (hillDistance <= 10) height = Math.min(5, Math.ceil((10 - hillDistance) / 2));

  if (y >= 34 && y <= 37) {
    if (x === 13) {
      height = 1;
      tile = TILE.Stairs;
    } else if (
      (x >= 14 && x <= 17) ||
      (x >= 20 && x <= 23) ||
      (x >= 27 && x <= 30) ||
      (x >= 35 && x <= 38)
    ) {
      height = 2;
    }
  }

  if (x >= 40 && x <= 55 && y >= 12 && y <= 27) {
    if (x <= 41) {
      if ((27 - y) % 4 === 0) {
        height = (27 - y) / 2 + 1;
        tile = TILE.Stairs;
      } else {
        height = 2 * (Math.floor((27 - y) / 4) + 1);
      }
    } else {
      height = 2 + 2 * Math.floor((27 - y) / 4);
    }
  }

  if (y >= 44 && y <= 51 && ((x >= 24 && x <= 28) || (x >= 32 && x <= 38))) height = 2;
  if (y === 52 && x >= 29 && x <= 31) height = 1;

  if (x >= 4 && x <= 18 && y >= 56 && y <= 59) {
    height = Math.floor((x - 4) / 2);
    if (height > 0) tile = TILE.Stairs;
  }

  if (x >= 50 && x <= 58 && y >= 50 && y <= 58) {
    height = 0;
    if (Math.abs(x - 54) <= 1 && Math.abs(y - 53) <= 1) tile = TILE.Wall;
    if (x === 54 && y === 54) tile = TILE.DoorSafeRoom;
  }

  return { tile, height, zone };
}

export function generateSandboxChunk(cx: number, cy: number): Chunk {
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE.Wall);
  const height = new Float32Array(CHUNK_SIZE * CHUNK_SIZE).fill(SANDBOX_WALL_HEIGHT);
  const zones = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  if (
    cx < SANDBOX_MIN_CHUNK ||
    cx > SANDBOX_MAX_CHUNK ||
    cy < SANDBOX_MIN_CHUNK ||
    cy > SANDBOX_MAX_CHUNK
  ) {
    return { cx, cy, tiles, height, zones };
  }

  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const x = cx * CHUNK_SIZE + lx;
      const y = cy * CHUNK_SIZE + ly;
      const i = ly * CHUNK_SIZE + lx;
      const sample = sampleAt(x, y);
      tiles[i] = sample.tile;
      height[i] = sample.height;
      zones[i] = sample.zone;
    }
  }

  return { cx, cy, tiles, height, zones };
}
