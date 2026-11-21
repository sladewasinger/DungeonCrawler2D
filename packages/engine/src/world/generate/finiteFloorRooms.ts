import { hash2D } from "../../core/rng.js";
import { carveAt, isCarved, localIndex } from "./finiteFloorBuffers.js";
import { profileForBiome } from "./finiteFloorBiomeProfiles.js";
import { roomBelongsToOneTerritory } from "./finiteFloorBiomes.js";
import { territoryProfile } from "./territories/territoryCatalog.js";
import { FLOOR_SEMANTIC, type FloorBounds, type FloorBuffers, type GeneratedRoom, type NormalizedFloorGenerationConfig } from "./finiteFloorTypes.js";

interface RoomPlacementInput {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly seed: number;
  readonly config: NormalizedFloorGenerationConfig;
  readonly targetCount?: number;
  readonly attemptBudget?: number;
  readonly attemptStart?: number;
  readonly roomIdStart?: number;
}

export interface RoomPlacementResult {
  readonly rooms: readonly GeneratedRoom[];
  readonly attemptsUsed: number;
  readonly nextRoomId: number;
}

export function placeRooms(input: RoomPlacementInput & { readonly firstRegionId: number }): RoomPlacementResult {
  const rooms: GeneratedRoom[] = [];
  const targetCount = input.targetCount ?? input.config.roomTargetCount;
  const attemptStart = input.attemptStart ?? 0;
  const roomIdStart = input.roomIdStart ?? 0;
  let attemptsUsed = 0;
  const attemptBudget = input.attemptBudget ?? input.config.roomAttemptBudget;
  while (placementNeedsRoom({ attemptsUsed, attemptBudget, roomCount: rooms.length, targetCount })) {
    const attempt = attemptStart + attemptsUsed;
    attemptsUsed++;
    const room = roomAtAttempt({ ...input, attempt, roomId: roomIdStart + rooms.length });
    if (!room) continue;
    stampRoom(input, room);
    rooms.push(room);
  }
  return { rooms, attemptsUsed, nextRoomId: roomIdStart + rooms.length };
}

function placementNeedsRoom(input: { readonly attemptsUsed: number; readonly attemptBudget: number; readonly roomCount: number; readonly targetCount: number }): boolean {
  return input.attemptsUsed < input.attemptBudget && input.roomCount < input.targetCount;
}

function roomAtAttempt(input: RoomPlacementInput & { readonly attempt: number; readonly roomId: number; readonly firstRegionId: number }): GeneratedRoom | null {
  const point = seededRoomPoint(input, input.attempt);
  const room = roomCandidate({ ...input, x: point.x, y: point.y, id: input.roomId, regionId: input.firstRegionId + input.roomId });
  return room && !roomIsBlocked(input, room) ? room : null;
}

function seededRoomPoint(input: RoomPlacementInput, attempt: number): { readonly x: number; readonly y: number } {
  const minX = input.bounds.minX + 2;
  const minY = input.bounds.minY + 2;
  const spanX = Math.max(1, input.bounds.width - 4);
  const spanY = Math.max(1, input.bounds.height - 4);
  return {
    x: minX + hash2D(input.seed, attempt, 0x51) % spanX,
    y: minY + hash2D(input.seed, attempt, 0xa7) % spanY,
  };
}

function roomCandidate(input: RoomPlacementInput & {
  readonly x: number;
  readonly y: number;
  readonly id: number;
  readonly regionId: number;
}): GeneratedRoom | null {
  const cellIndex = localIndex({ bounds: input.bounds, x: input.x, y: input.y });
  const territoryIndex = input.buffers.territory[cellIndex] ?? 0;
  const biomeId = input.buffers.biome[cellIndex] ?? 0;
  const territoryId = input.config.territoryRoster[territoryIndex] ?? input.config.territoryRoster[0];
  if (!territoryId) return null;
  const profile = territoryProfile(territoryId);
  if (!roomRollPasses(input, profile.roomChance)) return null;
  const width = roomDimension({
    base: input.config.roomSize * profile.roomScale,
    minimum: input.config.roomMinWidth,
    maximum: input.config.roomMaxWidth,
    variation: input.config.roomSizeVariation,
    roll: hash2D(input.seed, input.x, input.y + 1),
  });
  const height = roomDimension({
    base: input.config.roomSize * profile.roomScale,
    minimum: input.config.roomMinHeight,
    maximum: input.config.roomMaxHeight,
    variation: input.config.roomSizeVariation,
    roll: hash2D(input.seed, input.x + 1, input.y),
  });
  const x0 = oddCoordinate(input.x);
  const y0 = oddCoordinate(input.y);
  const rect = { x0, y0, x1: x0 + width - 1, y1: y0 + height - 1 };
  const room = makeRoom(input, rect, biomeId);
  return roomBelongsToOneTerritory({ buffers: input.buffers, bounds: input.bounds, ...room }) ? room : null;
}

function roomRollPasses(input: RoomPlacementInput & { readonly x: number; readonly y: number }, chance: number): boolean {
  const roll = hash2D(input.seed, input.x, input.y) / 0x1_0000_0000;
  return roll <= chance;
}

function makeRoom(input: { readonly id: number; readonly regionId: number }, rect: { x0: number; y0: number; x1: number; y1: number }, biomeId: number): GeneratedRoom {
  return {
    ...rect, id: input.id, regionId: input.regionId,
    biome: profileForBiome(biomeId).biome,
    center: { x: Math.floor((rect.x0 + rect.x1) / 2), y: Math.floor((rect.y0 + rect.y1) / 2) },
    wallEnvelope: { x0: rect.x0 - 1, y0: rect.y0 - 1, x1: rect.x1 + 1, y1: rect.y1 + 1 },
    entrances: [],
  };
}

function roomIsBlocked(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds }, room: GeneratedRoom): boolean {
  if (roomLeavesInterior(input.bounds, room)) return true;
  for (let y = room.y0 - 1; y <= room.y1 + 1; y++) {
    if (blockedRoomRow(input, room, y)) return true;
  }
  return false;
}

function roomLeavesInterior(bounds: FloorBounds, room: GeneratedRoom): boolean {
  return room.wallEnvelope.x0 <= bounds.minX || room.wallEnvelope.y0 <= bounds.minY
    || room.wallEnvelope.x1 >= bounds.maxX || room.wallEnvelope.y1 >= bounds.maxY;
}

function blockedRoomRow(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds }, room: GeneratedRoom, y: number): boolean {
  for (let x = room.x0 - 1; x <= room.x1 + 1; x++) {
    const index = localIndex({ bounds: input.bounds, x, y });
    if (isCarved(input.buffers, index) || input.buffers.protectedCells[index]) return true;
  }
  return false;
}

function stampRoom(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds }, room: GeneratedRoom): void {
  stampRoomEnvelope(input, room);
  stampRoomInterior(input, room);
}

function stampRoomEnvelope(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds }, room: GeneratedRoom): void {
  for (let y = room.wallEnvelope.y0; y <= room.wallEnvelope.y1; y++) {
    for (let x = room.wallEnvelope.x0; x <= room.wallEnvelope.x1; x++) {
      if (x > room.x0 && x < room.x1 && y > room.y0 && y < room.y1) continue;
      const index = localIndex({ bounds: input.bounds, x, y });
      input.buffers.roomWallIds[index] = room.id;
      input.buffers.protectedCells[index] = 1;
      input.buffers.semantic[index] = FLOOR_SEMANTIC.RoomWall;
    }
  }
}

function stampRoomInterior(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds }, room: GeneratedRoom): void {
  for (let y = room.y0; y <= room.y1; y++) {
    for (let x = room.x0; x <= room.x1; x++) {
      carveAt({ buffers: input.buffers, bounds: input.bounds, point: { x, y }, semantic: FLOOR_SEMANTIC.Room, regionId: room.regionId, roomId: room.id });
    }
  }
}

function roomDimension(input: { readonly base: number; readonly minimum: number; readonly maximum: number; readonly variation: number; readonly roll: number }): number {
  const wiggle = input.variation === 0 ? 0 : input.roll % (input.variation * 2 + 1) - input.variation;
  return oddSize(Math.max(input.minimum, Math.min(input.maximum, Math.round(input.base) + wiggle)));
}

function oddSize(value: number): number { return value % 2 === 0 ? value + 1 : value; }
function oddCoordinate(value: number): number { return Math.abs(value % 2) === 1 ? value : value + 1; }
