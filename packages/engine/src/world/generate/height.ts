// Deliberate height: a minority of rooms sink into pits or rise onto
// daises, always exactly the jumpable +/-1 (PLATFORM_TIER_STEP elsewhere
// in the engine, apex ~1.07 — see core/constants.ts's JUMP_VELOCITY/GRAVITY;
// 1 z-unit = 1 tile edge per that file's doctrine comment). A rarer "chasm"
// variant (grafted from the "caverns" candidate) drops a large room to -2
// with one guaranteed flat bridge deck — a real knockback-off-ledge kill
// zone. A pit/dais room gets EXACTLY ONE built staircase, at one
// deliberately-chosen doorway (carveRamp); every OTHER doorway meets the
// room at a plain, un-ramped edge — a real cliff you jump or fall, not a
// second staircase (docs/PORT_PLAN.md's "one straight run per transition,
// no clusters" stair redesign). A chasm room gets NO staircase at all —
// docs/R2-STAIRS-SPEC.md Open Question 1, resolved: a walkable-both-ways
// stair's low anchor must sit above CHASM_DEATH_Z, which a ramp descending
// to -2 cannot satisfy, so every chasm rim is a sheer, un-ramped edge;
// the guaranteed bridge (stampBridge) is the one crossing, and falling off
// the rim is the intended knockback-death ruling, not a climbable descent.
// Everything else stays flat, flat-first.

import { thresholdCells } from "./corridors.js";
import { rectHash } from "./hash.js";
import { rectH, rectW } from "./geometry.js";
import { TILE } from "../types.js";
import type { Doorway, Point, Rect, Room, Side } from "./types.js";

export const ROOM_RISE = 1;
export const CHASM_DEPTH = -2;
const CHASM_BRIDGE_HALF = 1; // 3-tile-wide guaranteed crossing
const CHASM_MIN_SPAN = 9; // room must be big enough to hold a real drop plus the bridge
// Retired as this generator's own tread budget (docs/R2-STAIRS-SPEC.md,
// Wave R2 compact stairs): carveRamp now emits exactly one tread per whole
// z (stepCount = round(|delta|)), walkable via the on-stair glide, which
// ignores STEP_UP entirely rather than needing a shallow per-tread slope.
// Kept alive ONLY as cliffs.ts's sub-tier auto-repair step size (a
// graze-edge fix well short of a full deliberate tier) — do not delete.
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

/**
 * Raise/lower the room's interior and its 1-tile wall ring — EXCEPT any
 * cell an unrelated corridor already carved straight through (a corridor
 * between two other rooms can graze this room's rect, interior included,
 * without an explicit doorway here; see cliffs.ts's module doc for the
 * same "stray pass-through" problem at the ring). Sinking a through-
 * corridor tile into the pit alongside it used to leave a notch a
 * grounded body could walk INTO (drops are free) but never back OUT of
 * except via the one primary-doorway ramp: the corridor-carved cell sat
 * flush with the corridor on one side and the room's full pit depth on
 * the other, so the ramp's own flanking tiles read as an "orphaned"
 * broken chain (pit depth -> ramp -> pit depth -> rim) instead of a
 * monotone one. A pass-through cell keeping its carved (flat) height
 * stays walkable straight through, exactly like a ring pass-through
 * already did — only cells this room actually owns sink into its variant.
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
      if (corridorCarved[i] === 1) continue;
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

/** In-bounds check shared by carveRampColumn's threshold/tread/landing writes. */
function inChunk(x: number, y: number, chunkSize: number): boolean {
  return x >= 0 && y >= 0 && x < chunkSize && y < chunkSize;
}

/**
 * One column of carveRamp's staircase: the threshold anchor, its Stairs
 * treads, and the landing anchor. Compact-stairs contract
 * (docs/R2-STAIRS-SPEC.md section 2): one tread per whole z, each at its
 * tile-CENTER midpoint height `fromHeight + sign(delta)*(n - 0.5)` — a
 * z0->z-1 pit gives exactly 1 tread at -0.5, flush with the rim (n=1: the
 * threshold) at one edge and the pit floor (the landing, one past the
 * last tread) at the other.
 */
function carveRampColumn(
  tiles: Uint8Array,
  height: Float32Array,
  chunkSize: number,
  origin: Point,
  step: { dx: number; dy: number },
  stepCount: number,
  fromHeight: number,
  toHeight: number,
): void {
  if (inChunk(origin.x, origin.y, chunkSize)) height[origin.y * chunkSize + origin.x] = fromHeight;
  const sign = Math.sign(toHeight - fromHeight);
  for (let n = 1; n <= stepCount; n++) {
    const sx = origin.x + step.dx * n;
    const sy = origin.y + step.dy * n;
    if (!inChunk(sx, sy, chunkSize)) continue;
    const i = sy * chunkSize + sx;
    tiles[i] = TILE.Stairs;
    height[i] = fromHeight + sign * (n - 0.5);
  }
  const lx = origin.x + step.dx * (stepCount + 1);
  const ly = origin.y + step.dy * (stepCount + 1);
  if (inChunk(lx, ly, chunkSize)) height[ly * chunkSize + lx] = toHeight;
}

/**
 * One straight, single-axis staircase from a doorway's threshold
 * (`fromHeight`, already the corridor's flat level) to a room's interior
 * (`toHeight`): one tread per whole z (docs/R2-STAIRS-SPEC.md's decision
 * summary — a z0->z-1 pit exit is exactly 1 tile, flush with the rim at
 * one edge and the pit floor at the other by construction). One call per
 * room transition, by construction: this is the room's ONLY built
 * staircase (see applyRoomHeight) — every other doorway stays a plain,
 * un-ramped edge.
 *
 * BOTH ends of the chain are force-set to their exact intended height —
 * the threshold (`fromHeight`, the doorway's own port) and the landing
 * (one step past the last Stairs tile, `toHeight`, back at the room's own
 * interior) — even though each is a plain Floor tile some OTHER pass
 * normally owns: stampRingHeight's pass-through protection can leave the
 * landing at a grazing corridor's flat height instead of this room's
 * depth (see its doc comment), and cliffs.ts's repairCliffs sweeps the
 * WHOLE chunk for violating edges with no notion of "this cell anchors a
 * deliberate ramp," so a tight cluster of rooms can nudge the threshold
 * off its assumed flat level on a later pass. Either drift flanks this
 * ramp's Stairs tile(s) with a same-height (or wrong-direction) neighbor
 * — a dead climb axis, not a ramp — and gets it demoted to a plain,
 * unclimbable Floor by demoteOrphanedStairs. This ramp is the room's
 * WHOLE reason either cell exists; it always wins that tug-of-war.
 */
function carveRamp(
  tiles: Uint8Array,
  height: Float32Array,
  chunkSize: number,
  doorway: Doorway,
  fromHeight: number,
  toHeight: number,
): void {
  const step = inwardStep(doorway.side);
  const stepCount = Math.round(Math.abs(toHeight - fromHeight));
  for (const origin of thresholdCells(doorway.room, doorway.side, doorway.center, doorway.width)) {
    carveRampColumn(tiles, height, chunkSize, origin, step, stepCount, fromHeight, toHeight);
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
 * Apply one room's height variant (if any). A pit/dais gets exactly one
 * consolidated ramp at one deliberately-chosen doorway (carveRamp), capped
 * to THRESHOLD_RAMP_MAX_WIDTH; every other doorway meets the room at a
 * plain, un-ramped edge — a real cliff you jump. A chasm gets NO ramp at
 * any doorway — every rim is sheer, crossed only by its guaranteed bridge
 * (stampBridge); falling off is the knockback-death ruling, not a climbable
 * descent (docs/R2-STAIRS-SPEC.md Open Question 1: a walkable-both-ways
 * stair's low anchor must sit above CHASM_DEATH_Z, which -2 cannot). A room
 * with no doorways at all just keeps its stamped height with no ramp
 * anywhere (unreachable by corridor; connectivity is guaranteed by the
 * corridor network, not by this pass).
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
  if (variant === "chasm") {
    stampBridge(height, chunkSize, room.rect);
    return;
  }
  const roomDoorways = doorways.filter((d) => d.room === room);
  const primary = pickPrimaryDoorway(seed, room, roomDoorways);
  if (!primary) return;
  const ramp = { ...primary, width: Math.min(primary.width, THRESHOLD_RAMP_MAX_WIDTH) };
  carveRamp(tiles, height, chunkSize, ramp, 0, value);
}
