// StairwayDown (floors 1-4) and StairwayUp (floors 2-FLOOR_CAP): the
// single per-floor landmark pair that carries players between floor sims.
// Both roles stamp the SAME small raised-stone structure (Epic 7.14's
// contract: "visually the same structure... an ascending glow" — only the
// client's glow tint tells them apart, out of this lane's scope) with a
// recessed "mouth" notch cut into its back wall: a shallow, NON-walkable
// gap in the rim, distinctly lower than the rest of the wall once
// wallHeight.ts's WALL_RISE pass runs — reads as a dark opening without
// any walkable height dip, which would risk an inescapable-step bug.
// Interaction is proximity-based (the sim validates
// the {type:"descend"} intent against `stairwayDownPosition`/
// `stairwayUpPosition` within INTERACT_RANGE, the same pattern
// `reviveDownedPartyMember` already uses) — no new TILE type needed.

import { CHUNK_SIZE, TILE, TOPOLOGY } from "../../core/types.js";
import {
  GENERATION_CHUNK_SIZE,
  scaleGeneratedCoordinate,
} from "../../generate/layout/scale.js";
import {
  FLOOR_CAP,
  pickRingChunk,
  structureAnchor,
  type ChunkCoord,
  type LocalAnchor,
  type WorldChunk,
} from "./descentShared.js";

export { FLOOR_CAP };

const UP_RADIUS = 1;
const DOWN_RADIUS = 2;
const UP_SALT = 0xde5c;
const DOWN_SALT = 0xde5d;
const ANCHOR_SALT = 0xde60;

const STRUCT_HALF_X = 2; // 5 tiles wide
const STRUCT_BACK = 3; // rows behind the anchor
const STRUCT_FRONT = 1; // rows in front, open approach
// Every wall run (back rim, mouth notch, side rim) must be >= 2 tiles deep:
// generate/verticalExtent.ts's resolveThinWalls merges any freestanding
// TOPOLOGY.Uncarved run under 2 tiles deep straight into Floor whenever both its
// north and south neighbors are open — confirmed live (bossArenaInvariant's
// first version) eating a 1-thick rim entirely. 2 back rows keep the rim
// AND the mouth notch both above that threshold.
const BACK_WALL_DEPTH = 2;
const STRUCT_CLEARANCE = Math.max(STRUCT_HALF_X, STRUCT_BACK, STRUCT_FRONT) + 1;
/**
 * Base (pre-WALL_RISE) height for the rim/side walls, giving the mouth
 * notch's own 0 base a visible recess once wallHeight.ts adds WALL_RISE to
 * both. NOT applied to the platform's floor: this exceeds STEP_UP (0.35),
 * so a floor this high would need a jump to approach — fine for shrine.ts's
 * purely decorative dais, wrong for a mandatory interact point a player
 * must be able to walk straight up to (the exact lesson fixed.ts's kiosk
 * door already forces to height 0 for the same reason). The floor here
 * always stays flush with the ground it's blended into.
 */
export const STAIRWAY_HEIGHT = 0.5;

export function stairwayUpChunk(world: Pick<WorldChunk, "worldSeed" | "floor">): ChunkCoord | null {
  if (world.floor < 2 || world.floor > FLOOR_CAP) return null;
  return pickRingChunk(world, { salt: UP_SALT, radius: UP_RADIUS });
}

export function stairwayDownChunk(world: Pick<WorldChunk, "worldSeed" | "floor">): ChunkCoord | null {
  if (world.floor < 1 || world.floor >= FLOOR_CAP) return null; // FLOOR_CAP has the boss arena instead
  return pickRingChunk(world, { salt: DOWN_SALT, radius: DOWN_RADIUS });
}

export function isStairwayUpChunk(chunk: WorldChunk): boolean {
  const target = stairwayUpChunk(chunk);
  return !!target && target.cx === chunk.cx && target.cy === chunk.cy;
}

export function isStairwayDownChunk(chunk: WorldChunk): boolean {
  const target = stairwayDownChunk(chunk);
  return !!target && target.cx === chunk.cx && target.cy === chunk.cy;
}

function anchorFor(chunk: WorldChunk): LocalAnchor {
  return structureAnchor(chunk, { salt: ANCHOR_SALT, clearance: STRUCT_CLEARANCE });
}

/** Stamp the shared StairwayUp/StairwayDown structure into this chunk, if it's this floor's chosen chunk for either role. Returns the open front threshold's LOCAL coords for generate/descentLink.ts's connector, or null if this chunk isn't either role. */
export interface DescentStructureContext {
  chunk: WorldChunk;
  tiles: Uint8Array;
  height: Float32Array;
}

export function applyDescentStructure(context: DescentStructureContext): LocalAnchor | null {
  const isRole = isStairwayUpChunk(context.chunk) || isStairwayDownChunk(context.chunk);
  if (!isRole) return null;
  const anchor = anchorFor(context.chunk);
  stampStructure(anchor, context.tiles, context.height);
  return { lx: anchor.lx, ly: anchor.ly + STRUCT_FRONT };
}

interface CellKind {
  tile: number;
  height: number;
}

/**
 * One footprint cell's tile/height, by its offset from the anchor: the
 * recessed back-wall mouth notch, the rest of the rim, or the
 * flush-with-ground platform interior. `alreadyOpen` (this cell was
 * ANY non-Wall tile before this stamp — a corridor, or a room's own
 * interior) wins over any wall classification: the BSP corridor graph is a
 * spanning tree (generate/bsp.ts) reached through specific rooms' own
 * floor, not just the corridor-tagged cells between them, so walling off
 * either kind here can isolate a whole subtree — confirmed live
 * (descentInvariant.test.ts) for both cases. Same "let a real crossing
 * punch a gate" doctrine generate/landmarks/{shrine,arena}.ts already use,
 * just widened from "corridor cells only" to "any pre-existing floor."
 */
function classifyCell(dx: number, dy: number, alreadyOpen: boolean): CellKind {
  if (alreadyOpen) return { tile: TILE.Floor, height: 0 };
  const isBackWall = dy <= -STRUCT_BACK + BACK_WALL_DEPTH - 1;
  if (isBackWall && dx === 0) return { tile: TOPOLOGY.Uncarved, height: 0 }; // the mouth notch — lower rim, reads as a shadowed opening
  const isSideWall = (dx === -STRUCT_HALF_X || dx === STRUCT_HALF_X) && dy < STRUCT_FRONT;
  if (isBackWall || isSideWall) return { tile: TOPOLOGY.Uncarved, height: STAIRWAY_HEIGHT };
  return { tile: TILE.Floor, height: 0 }; // flush with the ground it's blended into — see STAIRWAY_HEIGHT's doc comment
}

function stampStructure(anchor: LocalAnchor, tiles: Uint8Array, height: Float32Array): void {
  for (let dy = -STRUCT_BACK; dy <= STRUCT_FRONT; dy++) {
    for (let dx = -STRUCT_HALF_X; dx <= STRUCT_HALF_X; dx++) {
      stampStructureCell({ anchor, dx, dy, tiles, height });
    }
  }
}

interface StructureCellContext {
  anchor: LocalAnchor;
  dx: number;
  dy: number;
  tiles: Uint8Array;
  height: Float32Array;
}

function stampStructureCell(context: StructureCellContext): void {
  const lx = context.anchor.lx + context.dx;
  const ly = context.anchor.ly + context.dy;
  if (!isChunkCell(lx, ly)) return;
  const index = ly * GENERATION_CHUNK_SIZE + lx;
  const cell = classifyCell(context.dx, context.dy, context.tiles[index] !== TOPOLOGY.Uncarved);
  context.tiles[index] = cell.tile;
  context.height[index] = cell.height;
}

function isChunkCell(lx: number, ly: number): boolean {
  return lx >= 0 && ly >= 0 && lx < GENERATION_CHUNK_SIZE && ly < GENERATION_CHUNK_SIZE;
}

function positionFor(chunk: ChunkCoord | null, world: Pick<WorldChunk, "worldSeed" | "floor">): { x: number; y: number } | null {
  if (!chunk) return null;
  const anchor = anchorFor({ ...world, ...chunk });
  return {
    x: chunk.cx * CHUNK_SIZE + scaleGeneratedCoordinate(anchor.lx),
    y: chunk.cy * CHUNK_SIZE + scaleGeneratedCoordinate(anchor.ly),
  };
}

/** World position of this floor's StairwayUp anchor (null on floor 1, which has none). */
export function stairwayUpPosition(world: { worldSeed: number; floor: number }): { x: number; y: number } | null {
  return positionFor(stairwayUpChunk(world), world);
}

/** World position of this floor's StairwayDown landmark (null on FLOOR_CAP, which has the boss arena instead). */
export function stairwayDownPosition(world: { worldSeed: number; floor: number }): { x: number; y: number } | null {
  return positionFor(stairwayDownChunk(world), world);
}

/** Local-anchor + reach for the room-height guard (generate/landmarks/guard.ts): keeps ordinary pit/dais variance away from either role's footprint in its own chunk. */
export function descentGuardAnchor(chunk: WorldChunk): { lx: number; ly: number; reach: number } | null {
  const isRole = isStairwayUpChunk(chunk) || isStairwayDownChunk(chunk);
  if (!isRole) return null;
  const anchor = anchorFor(chunk);
  return { ...anchor, reach: Math.max(STRUCT_HALF_X, STRUCT_BACK, STRUCT_FRONT) + 2 };
}
