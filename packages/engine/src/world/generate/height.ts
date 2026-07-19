// Deliberate height: a minority of rooms sink into pits or rise onto
// daises, always exactly the jumpable +/-1 (PLATFORM_TIER_STEP elsewhere
// in the engine, apex ~1.07 — see core/constants.ts's JUMP_VELOCITY/GRAVITY;
// 1 z-unit = 1 tile edge per that file's doctrine comment). A rarer "chasm"
// variant (grafted from the "caverns" candidate) drops a large room to -2
// with one guaranteed flat bridge deck — a real knockback-off-ledge kill
// zone. Every height-variant room gets EXACTLY ONE built staircase, at one
// deliberately-chosen doorway (carveRamp); every OTHER doorway meets the
// room at a plain, un-ramped edge — a real cliff you jump or fall, not a
// second staircase (docs/PORT_PLAN.md's "one straight run per transition,
// no clusters" stair redesign). Everything else stays flat, flat-first.

import { thresholdCells } from "./corridors.js";
import { rectHash } from "./hash.js";
import { rectH, rectW } from "./geometry.js";
import { TILE } from "../types.js";
import type { Doorway, Rect, Room, Side } from "./types.js";

export const ROOM_RISE = 1;
export const CHASM_DEPTH = -2;
const CHASM_BRIDGE_HALF = 1; // 3-tile-wide guaranteed crossing
const CHASM_MIN_SPAN = 9; // room must be big enough to hold a real drop plus the bridge
// Per-tile slope budget for an authored ramp: kept well under STEP_UP so a
// body's per-tick rise while walking a run (slope * MOVE_SPEED * TICK_DT)
// never brushes the grounded step-up gate — see stairs.test.ts / the
// generator invariant test in stairsInvariant.test.ts.
export const MAX_STAIR_SLOPE = 0.5;
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

/** From a room-wall side to the unit step, INTO the room interior, a ramp climbs down along. */
function inwardStep(side: Side): { dx: number; dy: number } {
  if (side === 0) return { dx: 0, dy: 1 }; // N wall -> interior is south
  if (side === 2) return { dx: 0, dy: -1 }; // S wall -> interior is north
  if (side === 1) return { dx: -1, dy: 0 }; // E wall -> interior is west
  return { dx: 1, dy: 0 }; // W wall -> interior is east
}

/**
 * One straight, single-axis staircase from a doorway's threshold
 * (`fromHeight`, already the corridor's flat level) to a room's interior
 * (`toHeight`): as many equal-slope tiles as MAX_STAIR_SLOPE demands,
 * dividing the FULL gap into stepCount + 1 equal jumps so neither end tile
 * is flush with its flat neighbor (every physical Stairs tile keeps a
 * real, sign-detectable delta on both sides — see world/stairs.ts's
 * entryClimbDir and stairsInvariant.test.ts). One call per room transition,
 * by construction: this is the room's ONLY built staircase (see
 * applyRoomHeight) — every other doorway stays a plain, un-ramped edge.
 */
function carveRamp(
  tiles: Uint8Array,
  height: Float32Array,
  chunkSize: number,
  doorway: Doorway,
  fromHeight: number,
  toHeight: number,
): void {
  const { dx, dy } = inwardStep(doorway.side);
  const delta = toHeight - fromHeight;
  const stepCount = Math.max(1, Math.ceil(Math.abs(delta) / MAX_STAIR_SLOPE) - 1);
  for (const { x, y } of thresholdCells(doorway.room, doorway.side, doorway.center, doorway.width)) {
    for (let step = 1; step <= stepCount; step++) {
      const sx = x + dx * step;
      const sy = y + dy * step;
      if (sx < 0 || sy < 0 || sx >= chunkSize || sy >= chunkSize) continue;
      const i = sy * chunkSize + sx;
      tiles[i] = TILE.Stairs;
      height[i] = fromHeight + (delta * step) / (stepCount + 1);
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
 * Apply one room's height variant (if any). Every variant gets exactly one
 * consolidated ramp at one deliberately-chosen doorway (carveRamp), capped
 * to THRESHOLD_RAMP_MAX_WIDTH; every other doorway meets the room at a
 * plain, un-ramped edge — a real cliff (jump it, or for a chasm's depth,
 * fall and take the knockback-death ruling). A room with no doorways at
 * all just keeps its stamped height with no ramp anywhere (unreachable by
 * corridor; connectivity is guaranteed by the corridor network, not by
 * this pass).
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
  const primary = pickPrimaryDoorway(seed, room, roomDoorways);
  if (!primary) return;
  const ramp = { ...primary, width: Math.min(primary.width, THRESHOLD_RAMP_MAX_WIDTH) };
  if (variant === "chasm") {
    stampBridge(height, chunkSize, room.rect);
    carveRamp(tiles, height, chunkSize, ramp, 0, CHASM_DEPTH);
    return;
  }
  carveRamp(tiles, height, chunkSize, ramp, 0, value);
}
