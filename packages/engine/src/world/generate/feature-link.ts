// Guarantees the fixed safe-room/stairway pad (stamped by world/features/fixed.ts,
// unchanged from the default generator) is actually reachable from this chunk's
// own room network, rather than relying on the two layouts happening to land near
// each other. Diffs the tile grid across the stamp to find where it landed, then
// carves one more corridor from the nearest room — skipping over the pad's own
// protected tiles (stairs, doors, furniture) so the connector never erases them.

import { CHUNK_SIZE, TILE } from "../types.js";
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

function carveLegsSafe(tiles: Uint8Array, corridorCarved: Uint8Array, legs: Rect[]): void {
  for (const leg of legs) {
    for (let y = leg.y0; y <= leg.y1; y++) {
      for (let x = leg.x0; x <= leg.x1; x++) {
        if (x < 0 || y < 0 || x >= CHUNK_SIZE || y >= CHUNK_SIZE) continue;
        const i = y * CHUNK_SIZE + x;
        corridorCarved[i] = 1;
        if (PROTECTED.has(tiles[i] as number)) continue;
        tiles[i] = TILE.Floor;
      }
    }
  }
}

/** Connect the fixed feature the caller just stamped (diffed via `before`) to the nearest room. */
export function connectFixedFeaturePad(
  tiles: Uint8Array,
  corridorCarved: Uint8Array,
  before: Uint8Array,
  rooms: Room[],
): void {
  if (rooms.length === 0) return;
  const candidates = diffFloorCells(before, tiles);
  if (candidates.length === 0) return;
  const room = nearestRoom(rooms, candidates[0] as Point);
  const from: Point = { x: centerX(room.rect), y: centerY(room.rect) };
  const target = nearestCell(candidates, from);
  const legs = lPathLegs(from, Math.abs(target.x - from.x) < Math.abs(target.y - from.y), target, LINK_WIDTH, CHUNK_SIZE);
  carveLegsSafe(tiles, corridorCarved, legs);
}
