// Deliberate height: a minority of rooms sink into pits or rise onto
// daises, always exactly the jumpable +/-2 (PLATFORM_TIER_STEP elsewhere
// in the engine, apex ~2.2 — see core/constants.ts's JUMP_VELOCITY/GRAVITY).
// A rarer "chasm" variant (grafted from the "caverns" candidate) drops a
// large room to -4 with one guaranteed flat bridge deck — a real
// knockback-off-ledge kill zone. One doorway into a raised/sunken room
// becomes its single built stair ramp; every other doorway gets a plain
// two-hop step (no ramp tile at all — see softenSecondaryThreshold);
// everything else stays flat, per the flat-first rule.

import { thresholdCells } from "./corridors.js";
import { rectHash } from "./hash.js";
import { rectH, rectW } from "./geometry.js";
import { TILE } from "../types.js";
import type { Doorway, Rect, Room, Side } from "./types.js";

export const ROOM_RISE = 2;
export const CHASM_DEPTH = -4;
const CHASM_BRIDGE_HALF = 1; // 3-tile-wide guaranteed crossing
const CHASM_MIN_SPAN = 9; // room must be big enough to hold a real drop plus the bridge
const CHASM_RAMP_STEPS = -CHASM_DEPTH; // -1 per tile: 0 (corridor) down to CHASM_DEPTH
const THRESHOLD_RAMP_MAX_WIDTH = 2; // one built staircase reads as a place, not a fence

type Variant = "flat" | "pit" | "dais" | "chasm";

function pickVariant(seed: number, room: Room): Variant {
  // Kept deliberately rare: sunken pits, daises, and chasms should read as
  // set-pieces, not wallpaper — roughly one room in four, most stay flat-first.
  const roll = rectHash(seed, room.rect, 0x9007) % 30;
  if (roll < 1 && Math.min(rectW(room.rect), rectH(room.rect)) >= CHASM_MIN_SPAN) return "chasm";
  if (roll < 4) return "pit";
  if (roll < 7) return "dais";
  return "flat";
}

function variantValue(variant: Variant): number {
  if (variant === "chasm") return CHASM_DEPTH;
  if (variant === "pit") return -ROOM_RISE;
  if (variant === "dais") return ROOM_RISE;
  return 0;
}

function ring(rect: Rect): Rect {
  return { x0: rect.x0 - 1, y0: rect.y0 - 1, x1: rect.x1 + 1, y1: rect.y1 + 1 };
}

function isInterior(interior: Rect, x: number, y: number): boolean {
  return x >= interior.x0 && x <= interior.x1 && y >= interior.y0 && y <= interior.y1;
}

/**
 * Raise/lower the room's interior (always) and its 1-tile wall ring
 * (unless that ring cell already belongs to an unrelated corridor passing
 * by — a stray pass-through must keep its own flat level, not inherit
 * this room's variant; only this room's own doorways, carved afterward,
 * are allowed to ramp).
 */
function stampRingHeight(
  height: Float32Array,
  corridorCarved: Uint8Array,
  chunkSize: number,
  interior: Rect,
  value: number,
): void {
  const bounds = ring(interior);
  for (let y = bounds.y0; y <= bounds.y1; y++) {
    for (let x = bounds.x0; x <= bounds.x1; x++) {
      if (x < 0 || y < 0 || x >= chunkSize || y >= chunkSize) continue;
      const i = y * chunkSize + x;
      if (!isInterior(interior, x, y) && corridorCarved[i] === 1) continue;
      height[i] = value;
    }
  }
}

/** The chasm's one guaranteed flat crossing, centered on the room — everywhere else in the pit is a real drop. */
function stampBridge(height: Float32Array, chunkSize: number, interior: Rect): void {
  const bridgeX = Math.round((interior.x0 + interior.x1) / 2);
  for (let y = interior.y0; y <= interior.y1; y++) {
    for (let x = bridgeX - CHASM_BRIDGE_HALF; x <= bridgeX + CHASM_BRIDGE_HALF; x++) {
      if (x < 0 || y < 0 || x >= chunkSize || y >= chunkSize) continue;
      height[y * chunkSize + x] = 0;
    }
  }
}

function carveThreshold(
  tiles: Uint8Array,
  height: Float32Array,
  chunkSize: number,
  doorway: Doorway,
  rampHeight: number,
): void {
  for (const { x, y } of thresholdCells(doorway.room, doorway.side, doorway.center, doorway.width)) {
    if (x < 0 || y < 0 || x >= chunkSize || y >= chunkSize) continue;
    const i = y * chunkSize + x;
    tiles[i] = TILE.Stairs;
    height[i] = rampHeight;
  }
}

/** From a room-wall side to the unit step, INTO the room interior, a ramp climbs down along. */
function inwardStep(side: Side): { dx: number; dy: number } {
  if (side === 0) return { dx: 0, dy: 1 }; // N wall -> interior is south
  if (side === 2) return { dx: 0, dy: -1 }; // S wall -> interior is north
  if (side === 1) return { dx: -1, dy: 0 }; // E wall -> interior is west
  return { dx: 1, dy: 0 }; // W wall -> interior is east
}

/**
 * A chasm's drop (magnitude 4) is too steep for a single stair tile (the
 * engine's one-tile stair model tops out around magnitude 1-2 — see
 * world/stairs.ts's entryClimbDir). Rather than leaving it to cliffs.ts's
 * general STEP_UP sweep — which can cascade well past the room, through a
 * shared corridor, into whatever it meets next — carve an explicit,
 * room-confined multi-tile staircase: one -1 step per tile, straight into
 * the room from the doorway, bottoming out at the full depth exactly
 * where the uniform pit interior (stampRingHeight) already sits.
 */
function carveChasmRamp(tiles: Uint8Array, height: Float32Array, chunkSize: number, doorway: Doorway): void {
  const { dx, dy } = inwardStep(doorway.side);
  for (const { x, y } of thresholdCells(doorway.room, doorway.side, doorway.center, doorway.width)) {
    for (let step = 1; step <= CHASM_RAMP_STEPS; step++) {
      const sx = x + dx * step;
      const sy = y + dy * step;
      if (sx < 0 || sy < 0 || sx >= chunkSize || sy >= chunkSize) continue;
      const i = sy * chunkSize + sx;
      tiles[i] = TILE.Stairs;
      height[i] = (CHASM_DEPTH * step) / CHASM_RAMP_STEPS;
    }
  }
}

/**
 * One doorway, deterministically chosen, carries the room's single built
 * staircase — an "obvious built staircase" the way the old terrace
 * generator meant it, not one at every corridor that happens to touch the
 * room.
 */
function pickPrimaryDoorway(seed: number, room: Room, roomDoorways: Doorway[]): Doorway | null {
  if (roomDoorways.length === 0) return null;
  const idx = rectHash(seed, room.rect, 0x9008) % roomDoorways.length;
  return roomDoorways[idx] ?? null;
}

/**
 * Every doorway that ISN'T the room's one built staircase still meets a
 * height jump at the wall. Rather than leaving that to cliffs.ts's blunt
 * per-tile sweep — which, left to sweep both axes over several passes, can
 * converge unevenly and litter fractional-height flecks along the edge —
 * pre-soften the first interior row to the halfway height. Two STEP_UP-
 * sized hops (flat corridor -> half -> full) need no stair tile at all: a
 * secondary entrance reads as a plain step, not a second staircase.
 */
function softenSecondaryThreshold(
  height: Float32Array,
  chunkSize: number,
  doorway: Doorway,
  midHeight: number,
): void {
  const { dx, dy } = inwardStep(doorway.side);
  for (const { x, y } of thresholdCells(doorway.room, doorway.side, doorway.center, doorway.width)) {
    const ix = x + dx;
    const iy = y + dy;
    if (ix < 0 || iy < 0 || ix >= chunkSize || iy >= chunkSize) continue;
    height[iy * chunkSize + ix] = midHeight;
  }
}

/**
 * Apply one room's height variant (if any). Pit/dais get exactly one
 * consolidated threshold ramp, capped to THRESHOLD_RAMP_MAX_WIDTH, with
 * every other doorway softened to a plain, ramp-free step; chasm ramps
 * every one of its doorways with its own bounded multi-tile staircase
 * (carveChasmRamp) plus its guaranteed bridge deck — a chasm's drop is too
 * steep to leave any entrance ramp-free (see carveChasmRamp's doc comment).
 */
export function applyRoomHeight(
  seed: number,
  tiles: Uint8Array,
  height: Float32Array,
  corridorCarved: Uint8Array,
  chunkSize: number,
  room: Room,
  doorways: Doorway[],
): void {
  const variant = pickVariant(seed, room);
  if (variant === "flat") return;
  const value = variantValue(variant);
  stampRingHeight(height, corridorCarved, chunkSize, room.rect, value);
  const roomDoorways = doorways.filter((d) => d.room === room);
  if (variant === "chasm") {
    stampBridge(height, chunkSize, room.rect);
    for (const doorway of roomDoorways) carveChasmRamp(tiles, height, chunkSize, doorway);
    return;
  }
  const primary = pickPrimaryDoorway(seed, room, roomDoorways);
  if (!primary) return;
  const ramp = { ...primary, width: Math.min(primary.width, THRESHOLD_RAMP_MAX_WIDTH) };
  carveThreshold(tiles, height, chunkSize, ramp, value / 2);
  for (const doorway of roomDoorways) {
    if (doorway === primary) continue;
    softenSecondaryThreshold(height, chunkSize, doorway, value / 2);
  }
}
