// Binary space partition: recursively halve the chunk interior into leaf
// rects, one room per leaf, connected pairwise as the recursion unwinds —
// the classic BSP-dungeon spanning tree. `seed` is already chunk-specific
// (mixed with cx, cy by the caller); every hash here keys off a node's own
// rect bounds, so no salt needs threading through the recursion. `district`
// biases split depth (Warren subdivides further into tight cells, Plaza
// less so, for grand halls) and room flavor (see pickFlavor).

import { rectHash } from "./hash.js";
import { rectH, rectW } from "./geometry.js";
import { DISTRICT, type DistrictKind } from "./district.js";
import type { Rect, Room } from "../types.js";
import { WORLD_GENERATION_TUNING } from "../tuning.js";
import { pickRoomFlavor } from "./roomFlavor.js";

const ROOM_LAYOUT = WORLD_GENERATION_TUNING.roomLayout;

export interface BspResult {
  rooms: Room[];
  links: Array<[Room, Room]>;
}

interface PartitionContext extends BspResult {
  seed: number;
  district: DistrictKind;
}

/** Warren subdivides into more, smaller cells; Plaza subdivides less, for grand halls. */
function maxDepthFor(district: DistrictKind): number {
  if (district === DISTRICT.Warren) return ROOM_LAYOUT.maximumPartitionDepth + 1;
  if (district === DISTRICT.Plaza || district === DISTRICT.Arena) return ROOM_LAYOUT.maximumPartitionDepth - 1;
  return ROOM_LAYOUT.maximumPartitionDepth;
}

export function partitionChunk(chunkSeed: number, chunkSize: number, district: DistrictKind): BspResult {
  const initial: Rect = {
    x0: ROOM_LAYOUT.chunkBorderMargin,
    y0: ROOM_LAYOUT.chunkBorderMargin,
    x1: chunkSize - 1 - ROOM_LAYOUT.chunkBorderMargin,
    y1: chunkSize - 1 - ROOM_LAYOUT.chunkBorderMargin,
  };
  const rooms: Room[] = [];
  const links: Array<[Room, Room]> = [];
  const context = { seed: chunkSeed, district, rooms, links };
  partition(context, initial, maxDepthFor(district));
  return { rooms, links };
}

/** Recurse, collecting every leaf's room and every split's connecting edge; returns a representative room for the caller to link further up the tree. */
function partition(
  context: PartitionContext,
  rect: Rect,
  depth: number,
): Room {
  const canX = rectW(rect) >= ROOM_LAYOUT.minimumPartitionSpan * 2 + 1;
  const canY = rectH(rect) >= ROOM_LAYOUT.minimumPartitionSpan * 2 + 1;
  if (depth <= 0 || (!canX && !canY)) {
    const room = makeRoom(context.seed, rect, context.district);
    context.rooms.push(room);
    return room;
  }
  const splitX = canX && (!canY || rectW(rect) >= rectH(rect));
  const [a, b] = splitRect(context.seed, rect, splitX);
  const roomA = partition(context, a, depth - 1);
  const roomB = partition(context, b, depth - 1);
  context.links.push([roomA, roomB]);
  return roomA;
}

function splitRect(seed: number, rect: Rect, splitX: boolean): [Rect, Rect] {
  const minimum = ROOM_LAYOUT.minimumPartitionSpan;
  if (splitX) {
    const span = rectW(rect) - minimum * 2;
    const cut = rect.x0 + minimum - 1 + (span > 0 ? rectHash(seed, rect, 0x5111) % (span + 1) : 0);
    return [
      { ...rect, x1: cut },
      { ...rect, x0: cut + 1 },
    ];
  }
  const span = rectH(rect) - minimum * 2;
  const cut = rect.y0 + minimum - 1 + (span > 0 ? rectHash(seed, rect, 0x5112) % (span + 1) : 0);
  return [
    { ...rect, y1: cut },
    { ...rect, y0: cut + 1 },
  ];
}

function makeRoom(seed: number, leaf: Rect, district: DistrictKind): Room {
  const insetX = Math.min(
    randomRoomInset(seed, leaf, 0x1350),
    maximumRoomInset(rectW(leaf)),
  );
  const insetY = Math.min(
    randomRoomInset(seed, leaf, 0x1351),
    maximumRoomInset(rectH(leaf)),
  );
  const rect: Rect = {
    x0: leaf.x0 + insetX,
    y0: leaf.y0 + insetY,
    x1: leaf.x1 - insetX,
    y1: leaf.y1 - insetY,
  };
  return { rect, flavor: pickRoomFlavor(seed, rect, district) };
}

function maximumRoomInset(leafSpan: number): number {
  return Math.floor((leafSpan - ROOM_LAYOUT.minimumRoomSpan) / 2);
}

function randomRoomInset(seed: number, leaf: Rect, salt: number): number {
  const { min, max } = ROOM_LAYOUT.roomInset;
  return min + rectHash(seed, leaf, salt) % (max - min + 1);
}
