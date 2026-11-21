import { TILE } from "../core/types.js";
import { forEachCell, insideBounds } from "./finiteFloorBuffers.js";
import { analyzeFloorMovement, isMovementWalkable, type FloorMovementAnalysis } from "./finiteFloorMovement.js";
import { isReachable, validateRequiredComponents } from "./connections/validation/finiteFloorRequiredConnectivity.js";
import type { FloorAttempt, FloorBounds, FloorBuffers, FloorPoint, GeneratedFloor, NormalizedFloorGenerationConfig } from "./finiteFloorTypes.js";

export function validateFloorAttempt(input: {
  readonly attempt: FloorAttempt;
  readonly bounds: FloorBounds;
  readonly config: NormalizedFloorGenerationConfig;
  readonly allowOptionalLoopShortfall?: boolean;
}): readonly string[] {
  const movement = analyzeFloorMovement(input.attempt, input.bounds);
  return [
    ...validatePlanes(input.attempt.buffers, input.bounds),
    ...validateBoundary(input.attempt.buffers, input.bounds),
    ...movement.failures,
    ...validateFeaturePorts(input.attempt, input.bounds, movement),
    ...validateRequiredComponents({ attempt: input.attempt, bounds: input.bounds, movement }),
  ];
}

function validatePlanes(buffers: FloorBuffers, bounds: FloorBounds): string[] {
  const failures: string[] = [];
  if (buffers.tiles.length !== bounds.width * bounds.height) failures.push("floor plane dimensions disagree with bounds");
  for (let index = 0; index < buffers.tiles.length; index++) {
    if (!validTile(buffers.tiles[index])) failures.push(`invalid tile plane value ${buffers.tiles[index]}`);
    if (!validTerrain(buffers.terrain[index])) failures.push(`invalid terrain plane value ${buffers.terrain[index]}`);
  }
  return failures.slice(0, 8);
}

function validTile(tile: number | undefined): boolean {
  return tile === TILE.Floor || tile === TILE.Void || tile === TILE.Bedrock || tile === undefined;
}

function validTerrain(terrain: number | undefined): boolean {
  return terrain === undefined || terrain <= 1;
}

function validateBoundary(buffers: FloorBuffers, bounds: FloorBounds): string[] {
  const failures: string[] = [];
  forEachCell(bounds, (x, y, index) => {
    if ((x === bounds.minX || x === bounds.maxX || y === bounds.minY || y === bounds.maxY)
      && isMovementWalkable(buffers, index)) {
      failures.push(`finite floor boundary is walkable at ${x},${y}`);
    }
  });
  return failures.slice(0, 2);
}

function validateFeaturePorts(
  attempt: FloorAttempt,
  bounds: FloorBounds,
  movement: FloorMovementAnalysis,
): string[] {
  const failures: string[] = [];
  for (const feature of attempt.featureStamps) {
    const points = [...feature.ports, ...feature.protectedCells];
    if (points.some((point) => !pointInside(bounds, point))) failures.push(`${feature.id} leaves finite bounds`);
    if (feature.ports.some((port) => !isReachable(port, movement.reachable, bounds))) failures.push(`${feature.id} port is unreachable`);
  }
  return failures.slice(0, 10);
}

function pointInside(bounds: FloorBounds, point: FloorPoint): boolean {
  return insideBounds({ bounds, x: Math.floor(point.x), y: Math.floor(point.y) });
}

export function floorHasValidIdentity(floor: GeneratedFloor): boolean {
  return floor.identity.fingerprint.length > 0 && floor.identity.configurationFingerprint.length > 0;
}
