// Connects the StairwayUp/StairwayDown structure's open front threshold
// (features/descent.ts) to the nearest BSP room. Unlike feature-link.ts's
// generic connectFixedFeaturePad — which only ever touches TILE type, never
// height — this connector also flattens height to 0 along its own route:
// a route that crosses a pre-existing pit/dais/chasm ROOM (height.ts's
// room variance, already-Floor tiles a generic tile-diff connector can't
// even see as "touched") left a real STEP_UP-violating cliff mid-corridor
// even though every cell read as ordinary walkable Floor topologically —
// confirmed live (descentInvariant.test.ts) as a genuinely unreachable
// pocket, not a test artifact. Preferring an already-flat target room (most
// rooms — height.ts keeps variants to ~1 in 4) avoids reintroducing the
// same cliff at the room's own doorway instead.

import { TILE } from "../types.js";
import { GENERATION_CHUNK_SIZE as CHUNK_SIZE } from "./scale.js";
import { centerX, centerY, lPathLegs, rectDistance } from "./geometry.js";
import type { Point, Rect, Room } from "./types.js";

const LINK_WIDTH = 2;
const FLAT_TOLERANCE = 0.01;

interface FlatCarveContext {
  tiles: Uint8Array;
  corridorCarved: Uint8Array;
  height: Float32Array;
  legs: readonly Rect[];
}

function carveFlatLegs(context: FlatCarveContext): void {
  for (const leg of context.legs) carveFlatLeg(context, leg);
}

function carveFlatLeg(context: FlatCarveContext, leg: Rect): void {
  for (let y = leg.y0; y <= leg.y1; y++) {
    for (let x = leg.x0; x <= leg.x1; x++) stampFlatCell(context, x, y);
  }
}

function stampFlatCell(context: FlatCarveContext, x: number, y: number): void {
  if (x < 0 || y < 0 || x >= CHUNK_SIZE || y >= CHUNK_SIZE) return;
  const index = y * CHUNK_SIZE + x;
  context.tiles[index] = TILE.Floor;
  context.height[index] = 0;
  context.corridorCarved[index] = 1;
}

function roomHeight(height: Float32Array, rect: Rect): number {
  const i = centerY(rect) * CHUNK_SIZE + centerX(rect);
  return height[i] ?? 0;
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

/** Route a flat (height-0) corridor from `exit` (the structure's own open threshold) to the nearest already-flat BSP room, falling back to any room if none is flat. */
export interface DescentLinkContext extends Omit<FlatCarveContext, "legs"> {
  exit: Point;
  rooms: readonly Room[];
}

export function connectDescentStructure(context: DescentLinkContext): void {
  if (context.rooms.length === 0) return;
  const flat = context.rooms.filter((room) => Math.abs(roomHeight(context.height, room.rect)) <= FLAT_TOLERANCE);
  const room = nearestRoom(flat.length > 0 ? flat : context.rooms, context.exit);
  const from: Point = { x: centerX(room.rect), y: centerY(room.rect) };
  const aVertical = Math.abs(context.exit.x - from.x) < Math.abs(context.exit.y - from.y);
  const legs = lPathLegs({ from, fromVertical: aVertical, to: context.exit, width: LINK_WIDTH, size: CHUNK_SIZE });
  carveFlatLegs({ ...context, legs });
}
