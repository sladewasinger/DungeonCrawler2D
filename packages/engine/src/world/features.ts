import { hash2D, mixSeeds } from "../core/rng";
import {
  baseSample,
  seedsFor,
  smoothstep01,
  type CorridorSegment,
  type Seeds,
} from "./terrain";
import { CHUNK_SIZE, TILE } from "./types";

/**
 * Fixed features placed deterministically per floor: safe-room
 * entrances and stairways on sparse chunk grids, cleared, flattened,
 * and height-blended into the surrounding terrain.
 */

const SAFE_ROOM_SPACING = 3; // one safe room per 3×3 chunk cell
const SAFE_ROOM_HALF = 5; // room is (2*half+1)² tiles
const SAFE_ROOM_MARGIN = 3; // height-blend apron around the room

const STAIRS_MODULUS = 23; // ~1 in 23 chunks hosts a stairway

function posMod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function isSafeRoomChunk(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
): boolean {
  const layout = seedsFor(worldSeed, floor).layout;
  const offX = hash2D(mixSeeds(layout, 0x5afe), 1, 0) % SAFE_ROOM_SPACING;
  const offY = hash2D(mixSeeds(layout, 0x5afe), 0, 1) % SAFE_ROOM_SPACING;
  return posMod(cx, SAFE_ROOM_SPACING) === offX && posMod(cy, SAFE_ROOM_SPACING) === offY;
}

export function isStairsChunk(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
): boolean {
  if (isSafeRoomChunk(worldSeed, floor, cx, cy)) return false;
  const layout = seedsFor(worldSeed, floor).layout;
  return hash2D(mixSeeds(layout, 0x57a1), cx, cy) % STAIRS_MODULUS === 0;
}

/** Safe rooms and stairways: cleared, flattened, height-blended into terrain. */
export function applyFlattenedFeature(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
  seeds: Seeds,
  segs: CorridorSegment[],
  tiles: Uint8Array,
  height: Float32Array,
  zones: Uint8Array,
): void {
  const safeRoom = isSafeRoomChunk(worldSeed, floor, cx, cy);
  const stairs = isStairsChunk(worldSeed, floor, cx, cy);
  if (!safeRoom && !stairs) return;

  const half = safeRoom ? SAFE_ROOM_HALF : 1;
  const margin = SAFE_ROOM_MARGIN;
  const jitterRange = safeRoom ? 3 : 6;
  const jx = (hash2D(mixSeeds(seeds.layout, 0xf1a7), cx, cy) % (jitterRange * 2 + 1)) - jitterRange;
  const jy = (hash2D(mixSeeds(seeds.layout, 0xf1a8), cx, cy) % (jitterRange * 2 + 1)) - jitterRange;
  const centerLx = CHUNK_SIZE / 2 + jx;
  const centerLy = CHUNK_SIZE / 2 + jy;

  const centerSample = baseSample(
    seeds,
    segs,
    cx * CHUNK_SIZE + centerLx,
    cy * CHUNK_SIZE + centerLy,
  );
  const featureH = centerSample.height;

  const reach = half + margin;
  for (let ly = centerLy - reach; ly <= centerLy + reach; ly++) {
    for (let lx = centerLx - reach; lx <= centerLx + reach; lx++) {
      if (lx < 0 || ly < 0 || lx >= CHUNK_SIZE || ly >= CHUNK_SIZE) continue;
      const i = ly * CHUNK_SIZE + lx;
      const d = Math.max(Math.abs(lx - centerLx), Math.abs(ly - centerLy));
      tiles[i] = TILE.Floor;
      if (d <= half) {
        height[i] = featureH;
        if (!safeRoom) tiles[i] = TILE.Stairs;
      } else {
        const t = smoothstep01((d - half) / margin);
        height[i] = featureH + (height[i]! - featureH) * t;
      }
    }
  }

  if (safeRoom) {
    // The safe room itself is an instanced stretch room (rooms.ts); the
    // overworld only gets its entrance: a wall kiosk whose south face
    // is a portal door (GAME_DESIGN.md § Safe rooms).
    carveSafeRoomEntrance(tiles, centerLx, centerLy);
  }
}

/** 3×3 wall kiosk with the portal door in its south face. */
export function carveSafeRoomEntrance(
  tiles: Uint8Array,
  centerLx: number,
  centerLy: number,
): void {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const lx = centerLx + dx;
      const ly = centerLy + dy;
      if (lx < 0 || ly < 0 || lx >= CHUNK_SIZE || ly >= CHUNK_SIZE) continue;
      tiles[ly * CHUNK_SIZE + lx] = TILE.Wall;
    }
  }
  const doorLy = centerLy + 1;
  if (doorLy < CHUNK_SIZE) tiles[doorLy * CHUNK_SIZE + centerLx] = TILE.DoorSafeRoom;
}
