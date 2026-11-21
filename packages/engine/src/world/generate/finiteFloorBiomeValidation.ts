import { forEachCell, insideBounds, localIndex } from "./finiteFloorBuffers.js";
import { countPlaneComponents } from "./finiteFloorComponents.js";
import { isMovementWalkable } from "./finiteFloorMovement.js";
import { FLOOR_SEMANTIC, type FloorAttempt, type FloorBounds, type FloorBuffers, type FloorPoint, type NormalizedFloorGenerationConfig } from "./finiteFloorTypes.js";

interface BiomeValidationInput {
  readonly attempt: FloorAttempt;
  readonly bounds: FloorBounds;
  readonly config: NormalizedFloorGenerationConfig;
}

export function validateTerritories(input: BiomeValidationInput): string[] {
  const failures: string[] = [];
  const signatures = new Set<string>();
  let irregularDistricts = 0;
  for (let territory = 0; territory < input.config.territoryRoster.length; territory++) {
    const result = validateTerritory(input, territory);
    failures.push(...result.failures);
    irregularDistricts += result.irregular ? 1 : 0;
    signatures.add(result.signature);
  }
  if (input.config.territoryRoster.length > 1 && irregularDistricts < input.config.territoryRoster.length - 1) failures.push("territories are rectangular rather than irregular");
  if (signatures.size < input.config.territoryRoster.length) failures.push("territory layout profiles are not differentiated");
  return failures;
}

function validateTerritory(input: BiomeValidationInput, territory: number): {
  readonly failures: string[];
  readonly irregular: boolean;
  readonly signature: string;
} {
  const failures: string[] = [];
  const cells = territoryCells(input.attempt.buffers, input.bounds, territory);
  if (cells.length < input.config.minimumBiomeArea) failures.push(`territory ${territory} is below minimum district area`);
  const components = countPlaneComponents({ cells, plane: input.attempt.buffers.territory, bounds: input.bounds, value: territory });
  if (components !== 1) failures.push(`territory ${territory} is not contiguous`);
  return {
    failures,
    irregular: districtFillRatio(cells) < 0.95,
    signature: territoryGeometrySignature({ ...input, territory, cells }),
  };
}

function territoryCells(buffers: FloorBuffers, bounds: FloorBounds, territory: number): Array<{ x: number; y: number; index: number }> {
  const cells: Array<{ x: number; y: number; index: number }> = [];
  forEachCell(bounds, (x, y, index) => { if (buffers.territory[index] === territory) cells.push({ x, y, index }); });
  return cells;
}

function districtFillRatio(cells: readonly { x: number; y: number }[]): number {
  if (cells.length === 0) return 1;
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const cell of cells) {
    minX = Math.min(minX, cell.x); minY = Math.min(minY, cell.y);
    maxX = Math.max(maxX, cell.x); maxY = Math.max(maxY, cell.y);
  }
  return cells.length / ((maxX - minX + 1) * (maxY - minY + 1));
}

function territoryGeometrySignature(input: BiomeValidationInput & {
  readonly territory: number;
  readonly cells: readonly { x: number; y: number; index: number }[];
}): string {
  const rooms = input.attempt.rooms.filter((room) => input.attempt.buffers.territory[localIndex({ bounds: input.bounds, ...room.center })] === input.territory);
  const roomArea = rooms.reduce((sum, room) => sum + (room.x1 - room.x0 + 1) * (room.y1 - room.y0 + 1), 0);
  const averageRoomArea = rooms.length === 0 ? 0 : Math.round(roomArea / rooms.length / 20);
  const openCorridors = input.cells.filter((cell) => input.attempt.buffers.semantic[cell.index] === FLOOR_SEMANTIC.Corridor
    && walkableNeighborCount(input.attempt.buffers, input.bounds, cell) >= 3).length;
  const corridorScale = Math.round(openCorridors / Math.max(1, input.cells.length) * 1000);
  const layout = input.config.territoryRoster[input.territory] ?? "missing";
  return `${layout}:${averageRoomArea}:${corridorScale}:${rooms.length}`;
}

function walkableNeighborCount(buffers: FloorBuffers, bounds: FloorBounds, point: FloorPoint): number {
  return [{ x: point.x + 1, y: point.y }, { x: point.x - 1, y: point.y }, { x: point.x, y: point.y + 1 }, { x: point.x, y: point.y - 1 }]
    .filter((next) => insideBounds({ bounds, ...next }) && isMovementWalkable(buffers, localIndex({ bounds, ...next }))).length;
}
