import { carveAt, localIndex, isCarved, stampSolid } from "../finiteFloorBuffers.js";
import { FLOOR_SEMANTIC, type FloorBounds, type FloorBuffers, type FloorPoint, type GeneratedRoom, type GeneratedRoomEntrance } from "../finiteFloorTypes.js";
import { candidateOrder, roomSides, sideCandidates, type EntranceCandidate } from "./rooms/roomEntranceCandidates.js";

export interface RoomEntranceInput {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly rooms: readonly GeneratedRoom[];
  readonly seed: number;
  readonly width: number;
}

export interface RoomEntranceResult {
  readonly rooms: readonly GeneratedRoom[];
  readonly regionLinks: readonly (readonly [number, number])[];
}

export function registerRoomEntrances(input: RoomEntranceInput): RoomEntranceResult {
  const regionLinks: (readonly [number, number])[] = [];
  const rooms: GeneratedRoom[] = [];
  for (const room of input.rooms) {
    const candidate = chooseCandidate(input, room);
    if (!candidate) {
      discardRoom(input, room);
      continue;
    }
    const entrance = openEntrance(input, room, candidate);
    regionLinks.push([room.regionId, candidate.region]);
    rooms.push({ ...room, entrances: [entrance] });
  }
  return { rooms, regionLinks };
}

function chooseCandidate(input: RoomEntranceInput, room: GeneratedRoom): EntranceCandidate | null {
  const candidates = roomSides(room)
    .flatMap((side) => sideCandidates(input, room, side))
    .sort((left, right) => candidateOrder(input.seed, left, right));
  return candidates[0] ?? null;
}

function openEntrance(input: RoomEntranceInput, room: GeneratedRoom, candidate: EntranceCandidate): GeneratedRoomEntrance {
  for (const point of candidate.approach) {
    const index = localIndex({ bounds: input.bounds, ...point });
    if (!isCarved(input.buffers, index)) carveAt({ buffers: input.buffers, bounds: input.bounds, point, semantic: FLOOR_SEMANTIC.Transition, regionId: room.regionId });
    input.buffers.protectedCells[index] = 1;
  }
  for (const point of candidate.wall) {
    const index = localIndex({ bounds: input.bounds, ...point });
    input.buffers.roomWallIds[index] = -1;
    input.buffers.protectedCells[index] = 1;
    carveAt({ buffers: input.buffers, bounds: input.bounds, point, semantic: FLOOR_SEMANTIC.Transition, regionId: room.regionId });
  }
  const position = candidate.wall[Math.floor(candidate.wall.length / 2)];
  if (!position) throw new Error(`room ${room.id} entrance has no wall cells`);
  return { position, axis: candidate.axis, width: candidate.wall.length, connectedRegion: candidate.region };
}

function discardRoom(input: RoomEntranceInput, room: GeneratedRoom): void {
  for (let y = room.wallEnvelope.y0; y <= room.wallEnvelope.y1; y++) {
    for (let x = room.wallEnvelope.x0; x <= room.wallEnvelope.x1; x++) discardRoomCell(input, room, { x, y });
  }
}

function discardRoomCell(input: RoomEntranceInput, room: GeneratedRoom, point: FloorPoint): void {
  if (!insideBounds(input.bounds, point)) return;
  const index = localIndex({ bounds: input.bounds, ...point });
  if (input.buffers.roomIds[index] !== room.id && input.buffers.roomWallIds[index] !== room.id) return;
  stampSolid({ buffers: input.buffers, bounds: input.bounds, ...point });
  input.buffers.roomIds[index] = -1;
  input.buffers.roomWallIds[index] = -1;
  input.buffers.region[index] = 0;
  input.buffers.protectedCells[index] = 0;
  input.buffers.features[index] = 0;
  input.buffers.featureFaces[index] = 0;
  input.buffers.featureHeight[index] = 0;
  input.buffers.height[index] = 0;
}

function insideBounds(bounds: FloorBounds, point: FloorPoint): boolean {
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
}
