// Connects the boss arena's one gate (features/bossArena.ts) to the
// nearest BSP room WITHOUT ever touching another cell of the arena's
// sealed ring. A naive 2-leg L-path (feature-link.ts's own strategy)
// isn't safe here: whenever the nearest room sits roughly north/south of
// the arena, its vertical leg would run straight up the gate's own
// column, slicing clean through the opposite wall too — confirmed live by
// bossArenaInvariant.test.ts before this routing existed. The 3-leg route
// below is safe by construction: leg 1 travels along the gate's own
// throat row, already south of the ring's whole bounding box; leg 2
// travels along a column pushed OUTSIDE that box (`safeColumn`), so it
// can never re-enter the ring at any row; leg 3 (into the room) is only
// unsafe if the target room intersects the box, which the candidate
// filter excludes up front — so leg 3 is safe by exclusion, legs
// 1-2 are safe by construction, no case is left uncovered.
//
// Every carved cell also gets height forced to 0 (the arena's own flush
// height) and preference goes to an already-flat target room: the generic
// feature-link.ts connector only ever touches TILE type, and a route (or a
// target room) that keeps a pre-existing pit/dais/chasm height (height.ts's
// room variance) reads as ordinary walkable Floor topologically while
// still hard-blocking real STEP_UP-gated movement — the exact class of bug
// generate/descentLink.ts's own doc comment regression-locks for the
// sibling stairway connector.

import {
  ARENA_HALF,
  ARENA_THROAT_LENGTH,
} from "../../features/bossArena/bossArena.js";
import { CHUNK_SIZE, TILE } from "../../core/types.js";
import { centerX, centerY, rectDistance } from "../layout/geometry.js";
import type { Point, Room } from "../types.js";

const FLAT_TOLERANCE = 0.01;

interface CarveMap {
  tiles: Uint8Array;
  corridorCarved: Uint8Array;
  height: Float32Array;
}

function carveBand({ tiles, corridorCarved, height, x0, x1, y0, y1 }: CarveMap & { x0: number; x1: number; y0: number; y1: number }): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) carveCell({ tiles, corridorCarved, height, x, y });
  }
}

function carveCell({ tiles, corridorCarved, height, x, y }: CarveMap & Point): void {
  if (x < 0 || y < 0 || x >= CHUNK_SIZE || y >= CHUNK_SIZE) return;
  const index = y * CHUNK_SIZE + x;
  tiles[index] = TILE.Floor;
  height[index] = 0;
  corridorCarved[index] = 1;
}

function carveHorizontal({ y, xa, xb, ...map }: CarveMap & { y: number; xa: number; xb: number }): void {
  carveBand({ ...map, x0: Math.min(xa, xb), x1: Math.max(xa, xb), y0: y - 1, y1: y });
}

function carveVertical({ x, ya, yb, ...map }: CarveMap & { x: number; ya: number; yb: number }): void {
  carveBand({ ...map, x0: x - 1, x1: x, y0: Math.min(ya, yb), y1: Math.max(ya, yb) });
}

/** Straight exit south of the gate, clearing the ring's whole footprint (every row within ARENA_HALF of center). Returns the throat's far end. */
function carveThroat({ gate, ...map }: CarveMap & { gate: Point }): Point {
  const end: Point = { x: gate.x, y: gate.y + ARENA_THROAT_LENGTH };
  carveVertical({ ...map, x: gate.x, ya: gate.y, yb: end.y });
  return end;
}

function roomHeight(height: Float32Array, room: Room): number {
  const i = centerY(room.rect) * CHUNK_SIZE + centerX(room.rect);
  return height[i] ?? 0;
}

/** Nearest column to `targetX` that is guaranteed outside the ring's own column span — unchanged if already outside it. */
function safeColumn(targetX: number, boxCenterX: number): number {
  if (
    targetX < boxCenterX - ARENA_HALF ||
    targetX > boxCenterX + ARENA_HALF
  ) return targetX;
  return targetX < boxCenterX
    ? boxCenterX - ARENA_HALF - 1
    : boxCenterX + ARENA_HALF + 1;
}

/** Intersecting rooms may have every original doorway severed by the ring. */
function intersectsRing(room: Room, center: Point): boolean {
  const reach = ARENA_HALF + 1;
  return room.rect.x0 <= center.x + reach &&
    room.rect.x1 >= center.x - reach &&
    room.rect.y0 <= center.y + reach &&
    room.rect.y1 >= center.y - reach;
}

function nearestRoom(rooms: readonly Room[], p: Point): Room {
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

/** Route from the gate to the nearest intact, flat BSP room. */
export function connectBossArenaGate({ tiles, corridorCarved, height, gate, center, rooms }: CarveMap & {
  gate: Point;
  center: Point;
  rooms: readonly Room[];
}): void {
  if (rooms.length === 0) return;
  const map = { tiles, corridorCarved, height };
  const throatEnd = carveThroat({ ...map, gate });
  const candidates = rooms.filter((room) => !intersectsRing(room, center));
  const flat = candidates.filter((r) => Math.abs(roomHeight(height, r)) <= FLAT_TOLERANCE);
  const pool = flat.length > 0 ? flat : candidates.length > 0 ? candidates : rooms;
  const room = nearestRoom(pool, throatEnd);
  const roomCenter: Point = { x: centerX(room.rect), y: centerY(room.rect) };
  const corner = safeColumn(roomCenter.x, center.x);

  carveHorizontal({ ...map, y: throatEnd.y, xa: throatEnd.x, xb: corner }); // leg 1: along the safe throat row
  carveVertical({ ...map, x: corner, ya: throatEnd.y, yb: roomCenter.y }); // leg 2: along a column outside the ring
  carveHorizontal({ ...map, y: roomCenter.y, xa: corner, xb: roomCenter.x }); // leg 3: into the (non-ring) room
}
