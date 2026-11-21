import { BEDROCK_MIN_HEIGHT, TILE } from "../../core/types.js";
import { FLOOR_SEMANTIC, type FloorBounds, type FloorBuffers } from "../finiteFloorTypes.js";

export const ORDINARY_WALL_VISIBILITY_MARGIN = 2;

interface OrdinaryVisibilityMarginHeightInput {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly index: number;
  readonly height: number;
}

export function ordinaryVisibilityMarginHeight(input: OrdinaryVisibilityMarginHeightInput): number {
  return ordinarySurfaceTouchesBoundary(input.buffers, input.bounds, input.index)
    ? Math.max(0, input.height)
    : input.height;
}

export function ordinarySurfaceTouchesBoundary(
  buffers: FloorBuffers,
  bounds: FloorBounds,
  index: number,
): boolean {
  return isOrdinarySurface(buffers, index)
    && cardinalNeighbors(bounds, index).some((neighbor) => isOrdinaryBoundary(buffers, neighbor));
}

export function ordinaryBoundaryTop(
  buffers: FloorBuffers,
  bounds: FloorBounds,
  index: number,
): number | null {
  if (!isOrdinaryBoundary(buffers, index)) return null;
  const heights = adjacentOrdinaryHeights(buffers, bounds, index);
  if (heights.length === 0) return null;
  const lowest = Math.min(...heights);
  const highest = Math.max(...heights);
  return Math.max(BEDROCK_MIN_HEIGHT, highest, lowest + ORDINARY_WALL_VISIBILITY_MARGIN);
}

export function ordinaryBoundaryVisibilityIsValid(
  buffers: FloorBuffers,
  bounds: FloorBounds,
  index: number,
): boolean {
  if (!isOrdinaryBoundary(buffers, index)) return true;
  const heights = adjacentOrdinaryHeights(buffers, bounds, index);
  const wallTop = buffers.height[index] ?? 0;
  return heights.every((height) => wallTop >= height
    && wallTop - height <= ORDINARY_WALL_VISIBILITY_MARGIN);
}

export function isOrdinarySurface(buffers: FloorBuffers, index: number): boolean {
  const semantic = buffers.semantic[index];
  return buffers.tiles[index] === TILE.Floor && (
    semantic === FLOOR_SEMANTIC.Corridor
    || semantic === FLOOR_SEMANTIC.Room
    || semantic === FLOOR_SEMANTIC.Transition
  );
}

function isOrdinaryBoundary(buffers: FloorBuffers, index: number): boolean {
  return buffers.tiles[index] !== TILE.Floor
    && buffers.semantic[index] === FLOOR_SEMANTIC.Solid
    && hasNoAuthoredOwnership(buffers, index);
}

function hasNoAuthoredOwnership(buffers: FloorBuffers, index: number): boolean {
  return hasNoRoomOwnership(buffers, index) && hasNoFeatureOwnership(buffers, index);
}

function hasNoRoomOwnership(buffers: FloorBuffers, index: number): boolean {
  return (buffers.roomIds[index] ?? -1) < 0
    && (buffers.roomWallIds[index] ?? -1) < 0
    && (buffers.protectedCells[index] ?? 0) === 0;
}

function hasNoFeatureOwnership(buffers: FloorBuffers, index: number): boolean {
  return (buffers.featureIds[index] ?? -1) < 0
    && (buffers.features[index] ?? TILE.Floor) === TILE.Floor;
}

function adjacentOrdinaryHeights(
  buffers: FloorBuffers,
  bounds: FloorBounds,
  index: number,
): number[] {
  return cardinalNeighbors(bounds, index)
    .filter((neighbor) => isOrdinarySurface(buffers, neighbor))
    .map((neighbor) => buffers.height[neighbor] ?? 0);
}

function cardinalNeighbors(bounds: FloorBounds, index: number): number[] {
  const x = index % bounds.width;
  const y = Math.floor(index / bounds.width);
  const neighbors: number[] = [];
  if (x > 0) neighbors.push(index - 1);
  if (x + 1 < bounds.width) neighbors.push(index + 1);
  if (y > 0) neighbors.push(index - bounds.width);
  if (y + 1 < bounds.height) neighbors.push(index + bounds.width);
  return neighbors;
}
