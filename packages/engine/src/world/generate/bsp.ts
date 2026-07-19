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
import type { Flavor, Rect, Room } from "./types.js";

const MIN_LEAF = 6; // smallest splittable side; leaves are never smaller than this
const BASE_MAX_DEPTH = 4;
const BORDER_MARGIN = 3; // interior kept clear of the chunk edge for anchor corridors
const ROOM_INSET_MIN = 1;
const ROOM_INSET_MAX = 2;

export interface BspResult {
  rooms: Room[];
  links: Array<[Room, Room]>;
}

/** Warren subdivides into more, smaller cells; Plaza subdivides less, for grand halls. */
function maxDepthFor(district: DistrictKind): number {
  if (district === DISTRICT.Warren) return BASE_MAX_DEPTH + 1;
  if (district === DISTRICT.Plaza) return BASE_MAX_DEPTH - 1;
  return BASE_MAX_DEPTH;
}

export function partitionChunk(chunkSeed: number, chunkSize: number, district: DistrictKind): BspResult {
  const initial: Rect = {
    x0: BORDER_MARGIN,
    y0: BORDER_MARGIN,
    x1: chunkSize - 1 - BORDER_MARGIN,
    y1: chunkSize - 1 - BORDER_MARGIN,
  };
  const rooms: Room[] = [];
  const links: Array<[Room, Room]> = [];
  partition(chunkSeed, initial, maxDepthFor(district), district, rooms, links);
  return { rooms, links };
}

/** Recurse, collecting every leaf's room and every split's connecting edge; returns a representative room for the caller to link further up the tree. */
function partition(
  seed: number,
  rect: Rect,
  depth: number,
  district: DistrictKind,
  rooms: Room[],
  links: Array<[Room, Room]>,
): Room {
  const canX = rectW(rect) >= MIN_LEAF * 2 + 1;
  const canY = rectH(rect) >= MIN_LEAF * 2 + 1;
  if (depth <= 0 || (!canX && !canY)) {
    const room = makeRoom(seed, rect, district);
    rooms.push(room);
    return room;
  }
  const splitX = canX && (!canY || rectW(rect) >= rectH(rect));
  const [a, b] = splitRect(seed, rect, splitX);
  const roomA = partition(seed, a, depth - 1, district, rooms, links);
  const roomB = partition(seed, b, depth - 1, district, rooms, links);
  links.push([roomA, roomB]);
  return roomA;
}

function splitRect(seed: number, rect: Rect, splitX: boolean): [Rect, Rect] {
  if (splitX) {
    const span = rectW(rect) - MIN_LEAF * 2;
    const cut = rect.x0 + MIN_LEAF - 1 + (span > 0 ? rectHash(seed, rect, 0x5111) % (span + 1) : 0);
    return [
      { ...rect, x1: cut },
      { ...rect, x0: cut + 1 },
    ];
  }
  const span = rectH(rect) - MIN_LEAF * 2;
  const cut = rect.y0 + MIN_LEAF - 1 + (span > 0 ? rectHash(seed, rect, 0x5112) % (span + 1) : 0);
  return [
    { ...rect, y1: cut },
    { ...rect, y0: cut + 1 },
  ];
}

function makeRoom(seed: number, leaf: Rect, district: DistrictKind): Room {
  const insetX = ROOM_INSET_MIN + (rectHash(seed, leaf, 0x1350) % (ROOM_INSET_MAX - ROOM_INSET_MIN + 1));
  const insetY = ROOM_INSET_MIN + (rectHash(seed, leaf, 0x1351) % (ROOM_INSET_MAX - ROOM_INSET_MIN + 1));
  const rect: Rect = {
    x0: Math.min(leaf.x0 + insetX, leaf.x1 - 3),
    y0: Math.min(leaf.y0 + insetY, leaf.y1 - 3),
    x1: Math.max(leaf.x1 - insetX, leaf.x0 + 3),
    y1: Math.max(leaf.y1 - insetY, leaf.y0 + 3),
  };
  return { rect, flavor: pickFlavor(seed, rect, district) };
}

interface DistrictBias {
  kind: DistrictKind;
  threshold: number;
  flavor: Flavor;
  minArea?: number;
}

/** Each district's signature flavor and how strongly the roll favors it. */
const DISTRICT_BIASES: readonly DistrictBias[] = [
  { kind: DISTRICT.PillarForest, threshold: 65, flavor: "pillarHall" },
  { kind: DISTRICT.Ruins, threshold: 50, flavor: "grotto" },
  { kind: DISTRICT.Plaza, threshold: 55, flavor: "plaza", minArea: 50 },
];

function districtBiasedFlavor(district: DistrictKind, area: number, roll: number): Flavor | null {
  for (const bias of DISTRICT_BIASES) {
    if (bias.kind !== district) continue;
    if (bias.minArea !== undefined && area < bias.minArea) continue;
    if (roll < bias.threshold) return bias.flavor;
  }
  return null;
}

/** The generic, district-agnostic roll every leaf falls back to. */
function areaBiasedFlavor(area: number, roll: number): Flavor {
  if (area >= 90 && roll < 20) return "pillarHall";
  if (area >= 60 && roll < 40) return "plaza";
  if (area >= 70 && roll < 55) return "grotto";
  return "chamber";
}

/** District bends the flavor roll toward its signature room family; galleries (aspect) always win first. */
function pickFlavor(seed: number, rect: Rect, district: DistrictKind): Flavor {
  const w = rectW(rect);
  const h = rectH(rect);
  const area = w * h;
  const aspect = Math.max(w, h) / Math.max(1, Math.min(w, h));
  if (aspect >= 2.1) return "gallery";
  const roll = rectHash(seed, rect, 0x4a01) % 100;
  return districtBiasedFlavor(district, area, roll) ?? areaBiasedFlavor(area, roll);
}
