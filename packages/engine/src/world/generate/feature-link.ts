// Guarantees the fixed safe-room/stairway pad (stamped by world/features/fixed.ts,
// unchanged from the default generator) is actually reachable from this chunk's
// own room network, rather than relying on the two layouts happening to land near
// each other. Diffs the tile grid across the stamp to find where it landed, then
// carves one more corridor from the nearest room — skipping over the pad's own
// protected tiles (stairs, doors, furniture) so the connector never erases them.

import { TILE } from "../types.js";
import { GENERATION_CHUNK_SIZE as CHUNK_SIZE } from "./scale.js";
import { centerX, centerY, lPathLegs, rectDistance } from "./geometry.js";
import type { Point, Rect, Room } from "./types.js";

const LINK_WIDTH = 2;

const PROTECTED: ReadonlySet<number> = new Set([
  TILE.Stairs,
  TILE.DoorSafeRoom,
  TILE.DoorPersonal,
  TILE.DoorParty,
  TILE.DoorExit,
  TILE.CraftingTable,
  TILE.Stash,
]);

function diffFloorCells(before: Uint8Array, after: Uint8Array): Point[] {
  const cells: Point[] = [];
  for (let i = 0; i < after.length; i++) {
    if (before[i] === after[i]) continue;
    if (after[i] !== TILE.Floor) continue; // only plain floor is a safe corridor endpoint
    cells.push({ x: i % CHUNK_SIZE, y: Math.floor(i / CHUNK_SIZE) });
  }
  return cells;
}

function nearestRoom(rooms: Room[], p: Point): Room {
  let best = rooms[0] as Room;
  let bestDist = Infinity;
  for (const room of rooms) {
    const d = rectDistance(room.rect, p);
    if (d < bestDist) {
      bestDist = d;
      best = room;
    }
  }
  return best;
}

function nearestCell(cells: Point[], from: Point): Point {
  let best = cells[0] as Point;
  let bestDist = Infinity;
  for (const c of cells) {
    const d = Math.abs(c.x - from.x) + Math.abs(c.y - from.y);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

interface SafeCarveContext {
  tiles: Uint8Array;
  corridorCarved: Uint8Array;
  legs: readonly Rect[];
}

function carveLegsSafe(context: SafeCarveContext): void {
  for (const leg of context.legs) carveSafeLeg(context, leg);
}

function carveSafeLeg(context: SafeCarveContext, leg: Rect): void {
  for (let y = leg.y0; y <= leg.y1; y++) {
    for (let x = leg.x0; x <= leg.x1; x++) carveSafeCell(context, x, y);
  }
}

function carveSafeCell(context: SafeCarveContext, x: number, y: number): void {
  if (x < 0 || y < 0 || x >= CHUNK_SIZE || y >= CHUNK_SIZE) return;
  const index = y * CHUNK_SIZE + x;
  context.corridorCarved[index] = 1;
  if (PROTECTED.has(context.tiles[index] as number)) return;
  context.tiles[index] = TILE.Floor;
}

/** Connect the fixed feature the caller just stamped (diffed via `before`) to the nearest room. */
export interface FixedFeatureLinkContext extends Omit<SafeCarveContext, "legs"> {
  before: Uint8Array;
  rooms: Room[];
}

export function connectFixedFeaturePad(context: FixedFeatureLinkContext): void {
  if (context.rooms.length === 0) return;
  const candidates = diffFloorCells(context.before, context.tiles);
  if (candidates.length === 0) return;
  const room = nearestRoom(context.rooms, candidates[0] as Point);
  const from: Point = { x: centerX(room.rect), y: centerY(room.rect) };
  const target = nearestCell(candidates, from);
  const legs = lPathLegs({
    from,
    fromVertical: Math.abs(target.x - from.x) < Math.abs(target.y - from.y),
    to: target,
    width: LINK_WIDTH,
    size: CHUNK_SIZE,
  });
  carveLegsSafe({ ...context, legs });
}
