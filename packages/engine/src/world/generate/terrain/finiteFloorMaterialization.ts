import { BEDROCK_MIN_HEIGHT, TERRAIN, TILE, ZONE } from "../../core/types.js";
import { FLOOR_SEMANTIC, type FloorBounds, type FloorBuffers } from "../finiteFloorTypes.js";
import { ordinaryBoundaryTop } from "../elevation/ordinaryElevationVisibility.js";

export function materializeCell(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly voidTerrain: boolean; readonly index: number }): void {
  if (input.buffers.tiles[input.index] === TILE.Floor) materializeFloor(input.buffers, input.index);
  else if (input.buffers.semantic[input.index] === FLOOR_SEMANTIC.RoomWall) materializeRoomWall(input.buffers, input.index);
  else if (!materializeAuthoredCell(input.buffers, input.index)) materializeOrdinaryCell(input);
  assertBedrockMinimum(input.buffers, input.index);
}
function materializeOrdinaryCell(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly voidTerrain: boolean; readonly index: number }): void {
  input.buffers.tiles[input.index] = input.voidTerrain ? TILE.Void : TILE.Bedrock;
  input.buffers.terrain[input.index] = input.voidTerrain ? TERRAIN.Void : TERRAIN.Floor;
  input.buffers.height[input.index] = input.voidTerrain
    ? 0
    : ordinaryBoundaryTop(input.buffers, input.bounds, input.index) ?? BEDROCK_MIN_HEIGHT;
  input.buffers.semantic[input.index] = FLOOR_SEMANTIC.Solid;
}
function assertBedrockMinimum(buffers: FloorBuffers, index: number): void {
  if (buffers.tiles[index] === TILE.Bedrock && (buffers.height[index] ?? 0) < BEDROCK_MIN_HEIGHT) {
    throw new Error(`Materialized Bedrock cell ${index} is below z${BEDROCK_MIN_HEIGHT}`);
  }
}
function materializeFloor(buffers: FloorBuffers, index: number): void {
  buffers.tiles[index] = TILE.Floor;
  buffers.terrain[index] = TERRAIN.Floor;
  buffers.zones[index] = ZONE.None;
}
function materializeRoomWall(buffers: FloorBuffers, index: number): void {
  buffers.tiles[index] = TILE.Bedrock;
  buffers.terrain[index] = TERRAIN.Floor;
  buffers.height[index] = 2;
  buffers.zones[index] = ZONE.None;
}
function materializeAuthoredCell(buffers: FloorBuffers, index: number): boolean {
  const semantic = buffers.semantic[index];
  if (semantic === FLOOR_SEMANTIC.SafeRoom || semantic === FLOOR_SEMANTIC.MiniBossArena) {
    buffers.tiles[index] = TILE.Bedrock;
    buffers.terrain[index] = TERRAIN.Floor;
    buffers.height[index] = 2;
    buffers.zones[index] = ZONE.None;
    return true;
  }
  if (semantic === FLOOR_SEMANTIC.BossArena) {
    buffers.tiles[index] = TILE.Void;
    buffers.terrain[index] = TERRAIN.Void;
    buffers.height[index] = 0;
    buffers.zones[index] = ZONE.None;
    return true;
  }
  if (semantic !== FLOOR_SEMANTIC.SpawnExterior) return false;
  buffers.tiles[index] = TILE.Bedrock;
  buffers.terrain[index] = TERRAIN.Floor;
  buffers.height[index] = 3;
  buffers.zones[index] = ZONE.None;
  return true;
}
