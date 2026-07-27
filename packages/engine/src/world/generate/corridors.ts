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

export const CORRIDOR_WIDTH_MIN = 2;
const WIDTH_MAX = 3;
const PORT_JITTER = 2;

export interface CorridorContext {
  seed: number;
  tiles: Uint8Array;
  corridorCarved: Uint8Array;
  chunkSize: number;
  rooms: Room[];
  links: Array<[Room, Room]>;
  anchors: EdgeAnchor[];
}

interface CarvingContext extends CorridorContext {
  doorways: Doorway[];
}

export function carveCorridors(context: CorridorContext): Doorway[] {
  const doorways: Doorway[] = [];
  const carving = { ...context, doorways };
  for (const link of context.links) connectRooms(carving, link);
  for (const anchor of context.anchors) connectAnchor(carving, anchor, doorways);
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
function roomPort(context: { seed: number; room: Room; side: Side; salt: number }): Point {
  const r = context.room.rect;
  const jitter = (rectHash(context.seed, r, context.salt) % (PORT_JITTER * 2 + 1)) - PORT_JITTER;
  if (context.side === 0) return { x: clampInt(centerX(r) + jitter, r.x0 + 1, r.x1 - 1), y: r.y0 - 1 };
  if (context.side === 2) return { x: clampInt(centerX(r) + jitter, r.x0 + 1, r.x1 - 1), y: r.y1 + 1 };
  if (context.side === 1) return { x: r.x1 + 1, y: clampInt(centerY(r) + jitter, r.y0 + 1, r.y1 - 1) };
  return { x: r.x0 - 1, y: clampInt(centerY(r) + jitter, r.y0 + 1, r.y1 - 1) };
}

/** Along-wall coordinate of a threshold: x for N/S sides, y for E/W sides. */
function thresholdCenter(side: Side, port: Point): number {
  return isVertical(side) ? port.x : port.y;
}

export function corridorWidth(seed: number, a: Rect, b: Rect): number {
  const salted = rectHash(seed, { x0: a.x0, y0: a.y0, x1: b.x1, y1: b.y1 }, 0x9c02);
  return CORRIDOR_WIDTH_MIN + (salted % (WIDTH_MAX - CORRIDOR_WIDTH_MIN + 1));
}

function connectRooms(context: CarvingContext, [a, b]: [Room, Room]): void {
  const ca: Point = { x: centerX(a.rect), y: centerY(a.rect) };
  const cb: Point = { x: centerX(b.rect), y: centerY(b.rect) };
  const sideA = sideTo(ca, cb);
  const sideB = sideTo(cb, ca);
  const w = corridorWidth(context.seed, a.rect, b.rect);
  const portA = roomPort({ seed: context.seed, room: a, side: sideA, salt: 0x2201 ^ rectHash(context.seed, b.rect, 0x1111) });
  const portB = roomPort({ seed: context.seed, room: b, side: sideB, salt: 0x2202 ^ rectHash(context.seed, a.rect, 0x1111) });
  const legs = lPathLegs({ from: portA, fromVertical: isVertical(sideA), to: portB, width: w, size: context.chunkSize });
  carveLegs({ ...context, legs });
  context.doorways.push({ room: a, side: sideA, center: thresholdCenter(sideA, portA), width: w });
  context.doorways.push({ room: b, side: sideB, center: thresholdCenter(sideB, portB), width: w });
}

function connectAnchor(context: CorridorContext, anchor: EdgeAnchor, doorways: Doorway[]): void {
  const nearest = nearestRoom(context.rooms, anchor);
  if (!nearest) return;
  const roomSide = sideTo(anchor.point, { x: centerX(nearest.rect), y: centerY(nearest.rect) });
  const anchorSalt = anchor.side ^ (anchor.point.x * 131 + anchor.point.y);
  const port = roomPort({ seed: context.seed, room: nearest, side: roomSide, salt: 0x2203 ^ anchorSalt });
  const legs = lPathLegs({ from: anchor.point, fromVertical: isVertical(anchor.side), to: port, width: anchor.width, size: context.chunkSize });
  carveLegs({ ...context, legs });
  doorways.push({ room: nearest, side: roomSide, center: thresholdCenter(roomSide, port), width: anchor.width });
}

function nearestRoom(rooms: Room[], anchor: EdgeAnchor): Room | null {
  if (rooms.length === 0) return null;
  let nearest = rooms[0] as Room;
  let best = Infinity;
  for (const room of rooms) {
    const d = rectDistance(room.rect, anchor.point);
    if (d < best) {
      best = d;
      nearest = room;
    }
  }
  return nearest;
}

export function carveLegs(context: Pick<CorridorContext, "tiles" | "corridorCarved" | "chunkSize"> & { legs: Rect[] }): void {
  for (const leg of context.legs) carveRect({ ...context, rect: leg });
}

function carveRect(context: Pick<CorridorContext, "tiles" | "corridorCarved" | "chunkSize"> & { rect: Rect }): void {
  for (let y = context.rect.y0; y <= context.rect.y1; y++) {
    for (let x = context.rect.x0; x <= context.rect.x1; x++) {
      carveCell(context, x, y);
    }
  }
}

function carveCell(context: Pick<CorridorContext, "tiles" | "corridorCarved" | "chunkSize">, x: number, y: number): void {
  if (x < 0 || y < 0 || x >= context.chunkSize || y >= context.chunkSize) return;
  const index = y * context.chunkSize + x;
  context.tiles[index] = TILE.Floor;
  context.corridorCarved[index] = 1;
}

/** Cells of a room's wall-ring threshold, for the height pass to turn into stairs. */
export function thresholdCells(context: { room: Room; side: Side; center: number; width: number }): Point[] {
  return isVertical(context.side) ? horizontalThreshold(context) : verticalThreshold(context);
}

function horizontalThreshold(context: { room: Room; side: Side; center: number; width: number }): Point[] {
  const { a, b } = band({ center: context.center, width: context.width, min: context.room.rect.x0, max: context.room.rect.x1 });
  const y = context.side === 0 ? context.room.rect.y0 - 1 : context.room.rect.y1 + 1;
  return pointsOnAxis(a, b, (x) => ({ x, y }));
}

function verticalThreshold(context: { room: Room; side: Side; center: number; width: number }): Point[] {
  const { a, b } = band({ center: context.center, width: context.width, min: context.room.rect.y0, max: context.room.rect.y1 });
  const x = context.side === 1 ? context.room.rect.x1 + 1 : context.room.rect.x0 - 1;
  return pointsOnAxis(a, b, (y) => ({ x, y }));
}

function pointsOnAxis(start: number, end: number, pointAt: (value: number) => Point): Point[] {
  return Array.from({ length: end - start + 1 }, (_, offset) => pointAt(start + offset));
}
