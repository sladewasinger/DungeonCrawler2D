import { hash2D } from "../../core/rng.js";
import { CHUNK_SIZE, FEATURE_FACE, TILE } from "../core/types.js";
import { spawnRoomExteriorSite } from "../features/rooms/spawnExterior/spawnRoomExterior.js";
import { carveAt, forEachRect, insideBounds, localIndex, protectRect, stampFeature, stampSolid, carveLine } from "./finiteFloorBuffers.js";
import { FLOOR_SEMANTIC, type FloorBounds, type FloorBuffers, type FloorPoint, type GeneratedFeatureStamp, type GeneratedSafeRoomEntrance, type GeneratedStairway } from "./finiteFloorTypes.js";

export function placeSpawnExterior(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds }): GeneratedFeatureStamp {
  const door = spawnRoomExteriorSite().door;
  const bounds = { x0: door.x - 4, y0: door.y - 4, x1: door.x + 4, y1: door.y + 3 };
  forEachRect({ x0: door.x - 4, y0: door.y - 4, x1: door.x + 4, y1: door.y }, (x, y) => stampSpawnExteriorWall({ ...input, x, y }));
  forEachRect({ x0: door.x - 3, y0: door.y + 1, x1: door.x + 3, y1: door.y + 3 }, (x, y) => carveAt({ buffers: input.buffers, bounds: input.bounds, point: { x, y }, semantic: FLOOR_SEMANTIC.SpawnExterior, regionId: 1 }));
  stampFeature({ buffers: input.buffers, bounds: input.bounds, x: door.x, y: door.y, tile: TILE.DoorExit, face: FEATURE_FACE.South, height: 1 });
  protectRect({ buffers: input.buffers, bounds: input.bounds, rect: bounds });
  return { id: "spawn-exterior", kind: "spawn-exterior", bounds, ports: [{ x: door.x, y: door.y + 3 }], protectedCells: [door], position: { x: door.x, y: door.y + 3 } };
}

function stampSpawnExteriorWall(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly x: number; readonly y: number }): void {
  stampSolid(input);
  if (insideBounds(input)) input.buffers.semantic[localIndex(input)] = FLOOR_SEMANTIC.SpawnExterior;
}

export const SAFE_ROOM_CHUNKS = [{ cx: 2, cy: 2 }, { cx: 5, cy: 4 }, { cx: 8, cy: 6 }] as const;

export function placeSafeRooms(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly seed: number }): GeneratedSafeRoomEntrance[] {
  return SAFE_ROOM_CHUNKS.map((chunk, index) => placeSafeRoom({ ...input, chunk, index }));
}

function placeSafeRoom(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly seed: number; readonly chunk: { cx: number; cy: number }; readonly index: number }): GeneratedSafeRoomEntrance {
  const center = { x: input.chunk.cx * CHUNK_SIZE + 14 + hash2D(input.seed, input.index, 1) % 5, y: input.chunk.cy * CHUNK_SIZE + 14 + hash2D(input.seed, input.index, 2) % 5 };
  const door = { x: center.x, y: center.y + 1, featureFace: FEATURE_FACE.South };
  const bounds = { x0: center.x - 3, y0: center.y - 5, x1: center.x + 3, y1: center.y + 3 };
  forEachRect(bounds, (x, y) => stampSolid({ buffers: input.buffers, bounds: input.bounds, x, y, semantic: FLOOR_SEMANTIC.SafeRoom }));
  forEachRect({ x0: center.x - 2, y0: center.y - 4, x1: center.x + 2, y1: center.y + 1 }, (x, y) => {
    carveAt({ buffers: input.buffers, bounds: input.bounds, point: { x, y }, semantic: FLOOR_SEMANTIC.SafeRoom, regionId: 1 });
    input.buffers.height[localIndex({ bounds: input.bounds, x, y })] = 0;
  });
  carveAt({ buffers: input.buffers, bounds: input.bounds, point: { x: center.x, y: center.y + 2 }, semantic: FLOOR_SEMANTIC.SafeRoom, regionId: 1 });
  carveAt({ buffers: input.buffers, bounds: input.bounds, point: { x: center.x, y: center.y + 3 }, semantic: FLOOR_SEMANTIC.SafeRoom, regionId: 1 });
  const approach = safeRoomApproach(input, center);
  for (const point of approach) carveAt({ buffers: input.buffers, bounds: input.bounds, point, semantic: FLOOR_SEMANTIC.SafeRoom, regionId: 1 });
  stampFeature({ buffers: input.buffers, bounds: input.bounds, x: door.x, y: door.y, tile: TILE.DoorSafeRoom, face: door.featureFace, height: 1 });
  protectRect({ buffers: input.buffers, bounds: input.bounds, rect: bounds });
  for (const point of approach) protectPoint(input, point);
  return { id: `safe-room-${input.index}`, kind: "safe-room", bounds, ports: [{ x: center.x, y: center.y + 3 }], protectedCells: [door, ...approach], position: door, door };
}

function safeRoomApproach(input: { readonly bounds: FloorBounds }, center: FloorPoint): FloorPoint[] {
  const points: FloorPoint[] = [];
  for (let y = center.y + 2; y <= center.y + 6; y++) {
    for (let x = center.x - 1; x <= center.x + 1; x++) {
      if (insideBounds({ bounds: input.bounds, x, y })) points.push({ x, y });
    }
  }
  return points;
}

function protectPoint(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds }, point: FloorPoint): void {
  if (insideBounds({ bounds: input.bounds, ...point })) input.buffers.protectedCells[localIndex({ bounds: input.bounds, ...point })] = 1;
}

export function placeStairways(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly seed: number; readonly floor: number }): { down: GeneratedStairway[]; up: GeneratedStairway | null } {
  const down = input.floor >= 1 && input.floor < 5 ? [-1, 1, 2].map((slot, index) => stampStairway({ ...input, slot, index, role: "down" })) : [];
  const up = input.floor >= 2 ? stampStairway({ ...input, slot: -2, index: 0, role: "up" }) : null;
  return { down, up };
}

export function stairwayPositionForBounds(input: { readonly bounds: Pick<FloorBounds, "minX" | "minY" | "width" | "height">; readonly seed: number; readonly slot: number; readonly index: number }): FloorPoint {
  return {
    x: Math.floor(input.bounds.minX + input.bounds.width / 2 + input.slot * 48 + hash2D(input.seed, input.index + 10, 1) % 17 - 8),
    y: Math.floor(input.bounds.minY + input.bounds.height / 2 + ((input.slot + 1 + 3) % 3) * 48 + hash2D(input.seed, input.index + 10, 2) % 17 - 8),
  };
}

function stampStairway(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly seed: number; readonly floor: number; readonly slot: number; readonly index: number; readonly role: "up" | "down" }): GeneratedStairway {
  const position = stairwayPositionForBounds(input);
  const bounds = { x0: position.x - 3, y0: position.y - 3, x1: position.x + 3, y1: position.y + 3 };
  const semantic = input.role === "up" ? FLOOR_SEMANTIC.StairwayUp : FLOOR_SEMANTIC.StairwayDown;
  forEachRect(bounds, (x, y) => carveAt({ buffers: input.buffers, bounds: input.bounds, point: { x, y }, semantic, regionId: 1 }));
  stampFeature({ buffers: input.buffers, bounds: input.bounds, x: position.x, y: position.y, tile: TILE.Stairs, face: FEATURE_FACE.Top, height: 0.5, semantic });
  protectRect({ buffers: input.buffers, bounds: input.bounds, rect: bounds });
  return { id: `${input.role}-stair-${input.index}`, kind: input.role === "up" ? "up-stair" : "down-stair", role: input.role, position, chunk: { cx: Math.floor(position.x / CHUNK_SIZE), cy: Math.floor(position.y / CHUNK_SIZE) }, bounds, ports: [{ x: position.x, y: position.y + 3 }], protectedCells: [position] };
}

export function connectFeatures(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly features: readonly { readonly ports: readonly FloorPoint[] }[] }): void {
  const target = { x: input.bounds.minX + 12, y: input.bounds.minY + 12 };
  for (const feature of input.features) for (const port of feature.ports) carveLine({ buffers: input.buffers, bounds: input.bounds, from: port, to: target, semantic: FLOOR_SEMANTIC.Transition });
}
