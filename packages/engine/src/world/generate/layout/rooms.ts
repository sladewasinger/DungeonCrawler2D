// Stamps a Room's footprint into the tile grid: floor fill, plus interior
// obstruction for the pillarHall and grotto flavors. Pure mutation of
// `tiles`; height and corridors are separate passes.

import { hash2D, mixSeeds } from "../../../core/rng.js";
import { TILE, TOPOLOGY } from "../../core/types.js";
import { clampInt } from "./geometry.js";
import type { Room } from "../types.js";
import { WORLD_GENERATION_TUNING } from "../tuning.js";

const ROOM_DETAILS = WORLD_GENERATION_TUNING.roomDetails;

interface RoomStamp {
  tiles: Uint8Array;
  chunkSize: number;
  room: Room;
  seed: number;
}

export function stampRoom(stamp: RoomStamp): void {
  fillFloor(stamp);
  if (stamp.room.flavor === "pillarHall") stampPillars(stamp);
  if (stamp.room.flavor === "grotto") stampGrotto(stamp);
}

function fillFloor({ tiles, chunkSize, room }: RoomStamp): void {
  const { x0, y0, x1, y1 } = room.rect;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) fillFloorCell({ tiles, chunkSize, x, y });
  }
}

function fillFloorCell({ tiles, chunkSize, x, y }: { tiles: Uint8Array; chunkSize: number; x: number; y: number }): void {
  if (x >= 0 && y >= 0 && x < chunkSize && y < chunkSize) tiles[y * chunkSize + x] = TILE.Floor;
}

/** A jittered grid of single-tile pillars: the room reads as a hypostyle hall, not an empty box. */
function stampPillars({ tiles, chunkSize, room, seed }: RoomStamp): void {
  const { x0, y0, x1, y1 } = room.rect;
  for (let y = y0 + ROOM_DETAILS.pillarInset; y <= y1 - ROOM_DETAILS.pillarInset; y += ROOM_DETAILS.pillarSpacing) {
    for (let x = x0 + ROOM_DETAILS.pillarInset; x <= x1 - ROOM_DETAILS.pillarInset; x += ROOM_DETAILS.pillarSpacing) stampPillar({ tiles, chunkSize, room, seed, x, y });
  }
}

function stampPillar({ tiles, chunkSize, room, seed, x, y }: RoomStamp & { x: number; y: number }): void {
  const { x0, y0, x1, y1 } = room.rect;
  const radius = ROOM_DETAILS.pillarJitter;
  const jx = hash2D(mixSeeds(seed, 0x9331), x, y) % (radius * 2 + 1) - radius;
  const jy = hash2D(mixSeeds(seed, 0x9332), x, y) % (radius * 2 + 1) - radius;
  const px = clampInt(x + jx, x0 + 1, x1 - 1);
  const py = clampInt(y + jy, y0 + 1, y1 - 1);
  if (px >= 0 && py >= 0 && px < chunkSize && py < chunkSize) tiles[py * chunkSize + px] = TOPOLOGY.Uncarved;
}

/** Sparse rubble scatter: a natural, rough-edged chamber instead of a clean box. */
function stampGrotto({ tiles, chunkSize, room, seed }: RoomStamp): void {
  const { x0, y0, x1, y1 } = room.rect;
  for (let y = y0 + ROOM_DETAILS.rubbleInset; y <= y1 - ROOM_DETAILS.rubbleInset; y++) {
    for (let x = x0 + ROOM_DETAILS.rubbleInset; x <= x1 - ROOM_DETAILS.rubbleInset; x++) stampRubble({ tiles, chunkSize, seed, x, y });
  }
}

function stampRubble({ tiles, chunkSize, seed, x, y }: { tiles: Uint8Array; chunkSize: number; seed: number; x: number; y: number }): void {
  const isInside = x >= 0 && y >= 0 && x < chunkSize && y < chunkSize;
  const isRubble = hash2D(mixSeeds(seed, 0x6f01), x, y) % ROOM_DETAILS.rubbleChanceDenominator === 0;
  if (isInside && isRubble) tiles[y * chunkSize + x] = TOPOLOGY.Uncarved;
}
