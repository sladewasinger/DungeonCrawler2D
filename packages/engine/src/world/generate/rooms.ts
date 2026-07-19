// Stamps a Room's footprint into the tile grid: floor fill, plus interior
// obstruction for the pillarHall and grotto flavors. Pure mutation of
// `tiles`; height and corridors are separate passes.

import { hash2D, mixSeeds } from "../../core/rng.js";
import { TILE } from "../types.js";
import { clampInt } from "./geometry.js";
import type { Room } from "./types.js";

const PILLAR_SPACING = 4;
const PILLAR_INSET = 2;
const PILLAR_JITTER = 1; // grafted from "districts": a forest of columns, not a rigid lattice
const RUBBLE_INSET = 2;
const RUBBLE_CHANCE_DENOM = 6;

export function stampRoom(tiles: Uint8Array, chunkSize: number, room: Room, seed: number): void {
  fillFloor(tiles, chunkSize, room);
  if (room.flavor === "pillarHall") stampPillars(tiles, chunkSize, room, seed);
  if (room.flavor === "grotto") stampGrotto(tiles, chunkSize, room, seed);
}

function fillFloor(tiles: Uint8Array, chunkSize: number, room: Room): void {
  const { x0, y0, x1, y1 } = room.rect;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= chunkSize || y >= chunkSize) continue;
      tiles[y * chunkSize + x] = TILE.Floor;
    }
  }
}

/** A jittered grid of single-tile pillars: the room reads as a hypostyle hall, not an empty box. */
function stampPillars(tiles: Uint8Array, chunkSize: number, room: Room, seed: number): void {
  const { x0, y0, x1, y1 } = room.rect;
  for (let y = y0 + PILLAR_INSET; y <= y1 - PILLAR_INSET; y += PILLAR_SPACING) {
    for (let x = x0 + PILLAR_INSET; x <= x1 - PILLAR_INSET; x += PILLAR_SPACING) {
      const jx = (hash2D(mixSeeds(seed, 0x9331), x, y) % (PILLAR_JITTER * 2 + 1)) - PILLAR_JITTER;
      const jy = (hash2D(mixSeeds(seed, 0x9332), x, y) % (PILLAR_JITTER * 2 + 1)) - PILLAR_JITTER;
      const px = clampInt(x + jx, x0 + 1, x1 - 1);
      const py = clampInt(y + jy, y0 + 1, y1 - 1);
      if (px < 0 || py < 0 || px >= chunkSize || py >= chunkSize) continue;
      tiles[py * chunkSize + px] = TILE.Wall;
    }
  }
}

/** Sparse rubble scatter: a natural, rough-edged chamber instead of a clean box. */
function stampGrotto(tiles: Uint8Array, chunkSize: number, room: Room, seed: number): void {
  const { x0, y0, x1, y1 } = room.rect;
  for (let y = y0 + RUBBLE_INSET; y <= y1 - RUBBLE_INSET; y++) {
    for (let x = x0 + RUBBLE_INSET; x <= x1 - RUBBLE_INSET; x++) {
      if (x < 0 || y < 0 || x >= chunkSize || y >= chunkSize) continue;
      if (hash2D(mixSeeds(seed, 0x6f01), x, y) % RUBBLE_CHANCE_DENOM !== 0) continue;
      tiles[y * chunkSize + x] = TILE.Wall;
    }
  }
}
