import { TILE } from "../../core/types.js";
import { FLOOR_SEMANTIC, type FloorBounds, type FloorBuffers } from "../finiteFloorTypes.js";

export interface PhysicalOrdinaryInterfaceScan {
  readonly boundaryCount: number;
  readonly interfaceCount: number;
  readonly protectedInterfaceCount: number;
  readonly violationCount: number;
  readonly maximumFaceHeight: number;
}

interface PhysicalOrdinaryInterface {
  readonly boundary: number;
  readonly faceHeight: number;
  readonly protectedSurface: boolean;
}

export function scanPhysicalOrdinaryInterfaces(
  buffers: FloorBuffers,
  bounds: FloorBounds,
): PhysicalOrdinaryInterfaceScan {
  const interfaces = ordinaryBoundaryIndices(buffers)
    .flatMap((boundary) => physicalInterfacesAt({ buffers, bounds, boundary }));
  return summarizeInterfaces(interfaces);
}

function ordinaryBoundaryIndices(buffers: FloorBuffers): number[] {
  return Array.from({ length: buffers.tiles.length }, (_value, index) => index)
    .filter((index) => isUnownedOrdinaryBoundary(buffers, index));
}

function physicalInterfacesAt(input: {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly boundary: number;
}): PhysicalOrdinaryInterface[] {
  return cardinalNeighbors(input.bounds, input.boundary)
    .filter((neighbor) => isPhysicalOrdinarySurface(input.buffers, neighbor))
    .map((neighbor) => ({
      boundary: input.boundary,
      faceHeight: (input.buffers.height[input.boundary] ?? 0) - (input.buffers.height[neighbor] ?? 0),
      protectedSurface: (input.buffers.protectedCells[neighbor] ?? 0) === 1,
    }));
}

function summarizeInterfaces(interfaces: readonly PhysicalOrdinaryInterface[]): PhysicalOrdinaryInterfaceScan {
  const faceHeights = interfaces.map((entry) => entry.faceHeight);
  return {
    boundaryCount: new Set(interfaces.map((entry) => entry.boundary)).size,
    interfaceCount: interfaces.length,
    protectedInterfaceCount: interfaces.filter((entry) => entry.protectedSurface).length,
    violationCount: faceHeights.filter((height) => height < 0 || height > 2).length,
    maximumFaceHeight: Math.max(0, ...faceHeights),
  };
}

function isUnownedOrdinaryBoundary(buffers: FloorBuffers, index: number): boolean {
  return buffers.tiles[index] === TILE.Bedrock
    && buffers.semantic[index] === FLOOR_SEMANTIC.Solid
    && hasNoBoundaryOwnership(buffers, index);
}

function hasNoBoundaryOwnership(buffers: FloorBuffers, index: number): boolean {
  return (buffers.protectedCells[index] ?? 0) === 0
    && hasNoRoomOwnership(buffers, index)
    && (buffers.featureIds[index] ?? -1) < 0;
}

function hasNoRoomOwnership(buffers: FloorBuffers, index: number): boolean {
  return (buffers.roomIds[index] ?? -1) < 0
    && (buffers.roomWallIds[index] ?? -1) < 0;
}

function isPhysicalOrdinarySurface(buffers: FloorBuffers, index: number): boolean {
  const semantic = buffers.semantic[index];
  return buffers.tiles[index] === TILE.Floor && (
    semantic === FLOOR_SEMANTIC.Corridor
    || semantic === FLOOR_SEMANTIC.Room
    || semantic === FLOOR_SEMANTIC.Transition
  );
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
