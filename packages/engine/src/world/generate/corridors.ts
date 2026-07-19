// Carves the corridor network: one L-shaped, variable-width corridor per
// BSP sibling link, plus one connecting each chunk-edge anchor to its
// nearest room (anchors crossing a district boundary already carry an
// avenue-widened width from edges.ts). Records each carved threshold as a
// Doorway for the height pass to turn into a stair ramp where a room sits
// above/below the hall.

import { TILE } from "../types.js";
import type { EdgeAnchor } from "./edges.js";
import { band, centerX, centerY, clampInt, lPathLegs, rectDistance } from "./geometry.js";
import { rectHash } from "./hash.js";
import type { Doorway, Point, Rect, Room, Side } from "./types.js";

const WIDTH_MIN = 1;
const WIDTH_MAX = 3;
const PORT_JITTER = 2;

export function carveCorridors(
  seed: number,
  tiles: Uint8Array,
  corridorCarved: Uint8Array,
  chunkSize: number,
  rooms: Room[],
  links: Array<[Room, Room]>,
  anchors: EdgeAnchor[],
): Doorway[] {
  const doorways: Doorway[] = [];
  for (const [a, b] of links) connectRooms(seed, tiles, corridorCarved, chunkSize, a, b, doorways);
  for (const anchor of anchors) {
    connectAnchor(seed, tiles, corridorCarved, chunkSize, anchor, rooms, doorways);
  }
  return doorways;
}

function sideTo(from: Point, to: Point): Side {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 1 : 3;
  return dy >= 0 ? 2 : 0;
}

function isVertical(side: Side): boolean {
  return side === 0 || side === 2;
}

/**
 * A point just outside `room`'s wall on `side`, jittered along the wall and
 * clamped clear of corners. `salt` folds in the OTHER endpoint of this
 * specific connection (not just a constant) so two different links that
 * both leave the same room on the same side land at different points —
 * otherwise their corridors would share one trunk out of the doorway and
 * the second link's straight run is far more likely to barrel through
 * whatever room sits between them.
 */
function roomPort(seed: number, room: Room, side: Side, salt: number): Point {
  const r = room.rect;
  const jitter = (rectHash(seed, r, salt) % (PORT_JITTER * 2 + 1)) - PORT_JITTER;
  if (side === 0) return { x: clampInt(centerX(r) + jitter, r.x0 + 1, r.x1 - 1), y: r.y0 - 1 };
  if (side === 2) return { x: clampInt(centerX(r) + jitter, r.x0 + 1, r.x1 - 1), y: r.y1 + 1 };
  if (side === 1) return { x: r.x1 + 1, y: clampInt(centerY(r) + jitter, r.y0 + 1, r.y1 - 1) };
  return { x: r.x0 - 1, y: clampInt(centerY(r) + jitter, r.y0 + 1, r.y1 - 1) };
}

/** Along-wall coordinate of a threshold: x for N/S sides, y for E/W sides. */
function thresholdCenter(side: Side, port: Point): number {
  return isVertical(side) ? port.x : port.y;
}

function corridorWidth(seed: number, a: Rect, b: Rect): number {
  const salted = rectHash(seed, { x0: a.x0, y0: a.y0, x1: b.x1, y1: b.y1 }, 0x9c02);
  return WIDTH_MIN + (salted % (WIDTH_MAX - WIDTH_MIN + 1));
}

function connectRooms(
  seed: number,
  tiles: Uint8Array,
  corridorCarved: Uint8Array,
  chunkSize: number,
  a: Room,
  b: Room,
  doorways: Doorway[],
): void {
  const ca: Point = { x: centerX(a.rect), y: centerY(a.rect) };
  const cb: Point = { x: centerX(b.rect), y: centerY(b.rect) };
  const sideA = sideTo(ca, cb);
  const sideB = sideTo(cb, ca);
  const w = corridorWidth(seed, a.rect, b.rect);
  const portA = roomPort(seed, a, sideA, 0x2201 ^ rectHash(seed, b.rect, 0x1111));
  const portB = roomPort(seed, b, sideB, 0x2202 ^ rectHash(seed, a.rect, 0x1111));
  const legs = lPathLegs(portA, isVertical(sideA), portB, w, chunkSize);
  carveLegs(tiles, corridorCarved, chunkSize, legs);
  doorways.push({ room: a, side: sideA, center: thresholdCenter(sideA, portA), width: w });
  doorways.push({ room: b, side: sideB, center: thresholdCenter(sideB, portB), width: w });
}

function connectAnchor(
  seed: number,
  tiles: Uint8Array,
  corridorCarved: Uint8Array,
  chunkSize: number,
  anchor: EdgeAnchor,
  rooms: Room[],
  doorways: Doorway[],
): void {
  if (rooms.length === 0) return;
  let nearest = rooms[0] as Room;
  let best = Infinity;
  for (const room of rooms) {
    const d = rectDistance(room.rect, anchor.point);
    if (d < best) {
      best = d;
      nearest = room;
    }
  }
  const roomSide = sideTo(anchor.point, { x: centerX(nearest.rect), y: centerY(nearest.rect) });
  const anchorSalt = anchor.side ^ (anchor.point.x * 131 + anchor.point.y);
  const port = roomPort(seed, nearest, roomSide, 0x2203 ^ anchorSalt);
  const legs = lPathLegs(anchor.point, isVertical(anchor.side), port, anchor.width, chunkSize);
  carveLegs(tiles, corridorCarved, chunkSize, legs);
  doorways.push({ room: nearest, side: roomSide, center: thresholdCenter(roomSide, port), width: anchor.width });
}

export function carveLegs(tiles: Uint8Array, corridorCarved: Uint8Array, chunkSize: number, legs: Rect[]): void {
  for (const leg of legs) carveRect(tiles, corridorCarved, chunkSize, leg);
}

function carveRect(tiles: Uint8Array, corridorCarved: Uint8Array, chunkSize: number, rect: Rect): void {
  for (let y = rect.y0; y <= rect.y1; y++) {
    for (let x = rect.x0; x <= rect.x1; x++) {
      if (x < 0 || y < 0 || x >= chunkSize || y >= chunkSize) continue;
      const i = y * chunkSize + x;
      tiles[i] = TILE.Floor;
      corridorCarved[i] = 1;
    }
  }
}

/** Cells of a room's wall-ring threshold, for the height pass to turn into stairs. */
export function thresholdCells(room: Room, side: Side, center: number, width: number): Point[] {
  const r = room.rect;
  const pts: Point[] = [];
  if (side === 0 || side === 2) {
    const { a, b } = band(center, width, r.x0, r.x1);
    const y = side === 0 ? r.y0 - 1 : r.y1 + 1;
    for (let x = a; x <= b; x++) pts.push({ x, y });
    return pts;
  }
  const { a, b } = band(center, width, r.y0, r.y1);
  const x = side === 1 ? r.x1 + 1 : r.x0 - 1;
  for (let y = a; y <= b; y++) pts.push({ x, y });
  return pts;
}
