// Floor FLOOR_CAP's boss arena: a sealed 15x15-ish room around The Warden
// of Five's spawn anchor, walled on every side except one deliberate gate.
// Unlike the ordinary per-superchunk arena landmark (generate/landmarks/
// arena.ts), which opens wherever a corridor happens to cross, this ring
// is forced solid everywhere but its single gate cell, regardless of what
// corridors were carved through its footprint beforehand — "exactly one
// gate" is a hard placement guarantee (bossArena.test.ts), not a
// best-effort one. The gate SEALING itself (blocked while the boss lives,
// open on death) is server-authoritative game state, not generator
// geometry — out of this lane's scope; this file only guarantees the
// static shape and its one true opening, plus where the connector corridor
// (generate/bossArenaLink.ts) may route without breaching the ring
// anywhere else.

import { CHUNK_SIZE, TILE } from "../types.js";
import { FLOOR_CAP, pickRingChunk, structureAnchor, type ChunkCoord, type LocalAnchor } from "./descentShared.js";

const ARENA_RADIUS = 2;
const ARENA_SALT = 0xde5e;
const ANCHOR_SALT = 0xde61;
/** Half-width: the ring's outer edge sits (2*ARENA_HALF+1)^2 = 15x15 total footprint from center. */
export const ARENA_HALF = 7;
/**
 * The ring wall is 2 tiles thick (d in [ARENA_HALF - RING_THICKNESS + 1,
 * ARENA_HALF]), not 1: generate/verticalExtent.ts's resolveThinWalls merges
 * any freestanding TILE.Wall run under 2 tiles deep straight into Floor
 * wherever both its north and south neighbors are open — a 1-thick ring's
 * north/south spans (its east/west spans are naturally >=2*ARENA_HALF deep
 * already) hit exactly that case and got silently eaten, confirmed live by
 * an early version of bossArenaInvariant.test.ts. Shrinks the interior from
 * 15x15 to 11x11; the overall 15x15 footprint (what Epic 7.14's contract
 * describes) is unchanged.
 */
export const RING_THICKNESS = 2;
const RING_INNER_EDGE = ARENA_HALF - RING_THICKNESS + 1;
/** How far past the ring's own footprint the gate connector's straight exit throat runs (generate/bossArenaLink.ts) — 1 tile already fully clears the ring's bounding box on the gate's axis; +1 is a visual buffer. */
export const ARENA_THROAT_LENGTH = 2;
const ARENA_CLEARANCE = ARENA_HALF + 1 + ARENA_THROAT_LENGTH;
/** Local offset of the arena's one gate: a 1-wide notch cut through the full 2-tile ring thickness, on the south wall. */
const GATE_DX = 0;
const GATE_DY = ARENA_HALF;

export function bossArenaChunk(worldSeed: number, floor: number): ChunkCoord | null {
  if (floor !== FLOOR_CAP) return null;
  return pickRingChunk(worldSeed, floor, ARENA_SALT, ARENA_RADIUS);
}

export function isBossArenaChunk(worldSeed: number, floor: number, cx: number, cy: number): boolean {
  const target = bossArenaChunk(worldSeed, floor);
  return !!target && target.cx === cx && target.cy === cy;
}

function anchorFor(worldSeed: number, floor: number, cx: number, cy: number): LocalAnchor {
  return structureAnchor(worldSeed, floor, cx, cy, ANCHOR_SALT, ARENA_CLEARANCE);
}

export interface BossArenaStamp {
  /** The ring's local center — also the boss spawn anchor. */
  center: LocalAnchor;
  /** The one local gate cell, on the ring's south wall. */
  gate: LocalAnchor;
}

/** Stamp the sealed ring + interior into this chunk if it's FLOOR_CAP's arena chunk. Returns the center/gate LOCAL coords for generate/bossArenaLink.ts's connector, or null if this chunk isn't the arena. */
export function applyBossArena(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
  tiles: Uint8Array,
  height: Float32Array,
): BossArenaStamp | null {
  if (!isBossArenaChunk(worldSeed, floor, cx, cy)) return null;
  const anchor = anchorFor(worldSeed, floor, cx, cy);
  stampRing(anchor, tiles, height);
  return { center: anchor, gate: { lx: anchor.lx + GATE_DX, ly: anchor.ly + GATE_DY } };
}

/** True for the gate's full-thickness notch: every ring row on its column, not just the outer cell. */
function isGateCell(dx: number, dy: number): boolean {
  return dx === GATE_DX && dy >= RING_INNER_EDGE && dy <= ARENA_HALF;
}

function stampRing(anchor: LocalAnchor, tiles: Uint8Array, height: Float32Array): void {
  for (let dy = -ARENA_HALF; dy <= ARENA_HALF; dy++) {
    for (let dx = -ARENA_HALF; dx <= ARENA_HALF; dx++) {
      const lx = anchor.lx + dx;
      const ly = anchor.ly + dy;
      if (lx < 0 || ly < 0 || lx >= CHUNK_SIZE || ly >= CHUNK_SIZE) continue;
      const i = ly * CHUNK_SIZE + lx;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      const isWall = d >= RING_INNER_EDGE && !isGateCell(dx, dy);
      tiles[i] = isWall ? TILE.Wall : TILE.Floor;
      height[i] = 0;
    }
  }
}

function worldPoint(anchor: LocalAnchor, chunk: ChunkCoord, dx: number, dy: number): { x: number; y: number } {
  return { x: chunk.cx * CHUNK_SIZE + anchor.lx + dx, y: chunk.cy * CHUNK_SIZE + anchor.ly + dy };
}

/** World position of FLOOR_CAP's arena gate (null off FLOOR_CAP). */
export function bossArenaGatePosition(world: { worldSeed: number; floor: number }): { x: number; y: number } | null {
  const chunk = bossArenaChunk(world.worldSeed, world.floor);
  if (!chunk) return null;
  return worldPoint(anchorFor(world.worldSeed, world.floor, chunk.cx, chunk.cy), chunk, GATE_DX, GATE_DY);
}

/** World position of FLOOR_CAP's boss spawn anchor: the arena's own center (null off FLOOR_CAP). */
export function bossArenaSpawnAnchor(world: { worldSeed: number; floor: number }): { x: number; y: number } | null {
  const chunk = bossArenaChunk(world.worldSeed, world.floor);
  if (!chunk) return null;
  return worldPoint(anchorFor(world.worldSeed, world.floor, chunk.cx, chunk.cy), chunk, 0, 0);
}

/** Local-anchor + reach for the room-height guard (generate/landmarks/guard.ts): keeps ordinary pit/dais variance away from the arena's own footprint in its chunk. */
export function bossArenaGuardAnchor(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
): { lx: number; ly: number; reach: number } | null {
  if (!isBossArenaChunk(worldSeed, floor, cx, cy)) return null;
  return { ...anchorFor(worldSeed, floor, cx, cy), reach: ARENA_HALF + 2 };
}
