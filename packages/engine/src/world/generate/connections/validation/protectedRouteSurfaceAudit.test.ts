import { describe, expect, it } from "vitest";
import { TILE } from "../../../core/types.js";
import { localIndex } from "../../finiteFloorBuffers.js";
import { isMovementWalkable, analyzeFloorMovement } from "../../finiteFloorMovement.js";
import { FLOOR_SEMANTIC } from "../../finiteFloorTypes.js";
import { cloneGeneratedFloor, generateFiniteFloorTraceForTests } from "../../finiteFloor.js";
import { attemptRouteTargets } from "../../finiteFloorFeatureSet.js";
import { auditProtectedRouteSurfaces } from "./protectedRouteSurfaceAudit.js";

const REQUESTS = [
  { worldSeed: 1, floor: 1, config: { roomSizeVariation: 10 } },
  { worldSeed: 2, floor: 1, config: { roomSizeVariation: 10 } },
] as const;

const EXPECTED_DENSITY = [
  {
    routeCount: 840, routePointCount: 210624,
    uniqueRouteCellCount: 20963, totalEdgeCount: 209784,
    uniqueEdgeCount: 20962, repeatedEdgeCount: 188822,
    duplicateEndpointCount: 0, connectorCount: 766,
    directionCounts: { east: 77976, north: 22422, south: 97788, west: 11598 },
  },
  {
    routeCount: 855, routePointCount: 232576,
    uniqueRouteCellCount: 21875, totalEdgeCount: 231721,
    uniqueEdgeCount: 21874, repeatedEdgeCount: 209847,
    duplicateEndpointCount: 0, connectorCount: 781,
    directionCounts: { east: 89609, north: 13347, south: 121217, west: 7548 },
  },
] as const;

describe("protected route final surfaces", () => {
  it("reconciles exact seed-1/2 route density with authoritative final surfaces", () => {
    REQUESTS.forEach((request, index) => {
      const result = generateFiniteFloorTraceForTests(request);
      const audit = auditProtectedRouteSurfaces({
        attempt: floorAttempt(result.floor), bounds: result.floor.bounds,
      });
      const expected = EXPECTED_DENSITY[index];
      if (!expected) throw new Error(`missing seed audit expectation ${index}`);
      expect(audit).toMatchObject(expected);
      expect(audit.failureCount).toBe(0);
      expect(audit.failures).toEqual([]);
      expectRouteTargetsMatchEndpoints(result.floor);
      expectStageThreeIntentOnFinalSurface(result);
    });
  }, 60_000);

  it("reports a protected route overwritten by final Bedrock", () => {
    const request = REQUESTS[0];
    if (!request) throw new Error("missing protected route audit request");
    const generated = generateFiniteFloorTraceForTests(request).floor;
    const floor = cloneGeneratedFloor(generated);
    const point = floor.routes.find((route) => route.length > 1)?.[1];
    if (!point) throw new Error("missing protected route fixture point");
    floor.tiles[localIndex({ bounds: floor.bounds, ...point })] = TILE.Bedrock;

    const audit = auditProtectedRouteSurfaces({ attempt: floorAttempt(floor), bounds: floor.bounds });

    expect(audit.failureCount).toBeGreaterThan(0);
    expect(audit.failures[0]).toContain(`at ${point.x},${point.y} has tile ${TILE.Bedrock}`);
  }, 30_000);
});

function expectRouteTargetsMatchEndpoints(
  floor: ReturnType<typeof generateFiniteFloorTraceForTests>["floor"],
): void {
  const targets = attemptRouteTargets({
    features: floor.featureStamps, rooms: floor.rooms, connectors: floor.connectors,
  });
  const endpoints = floor.routes.map((route) => route.at(-1)).filter((point) => point !== undefined);
  expect(new Set(targets.map(pointKey)).size).toBe(targets.length);
  expect(endpoints.map(pointKey).sort()).toEqual(targets.map(pointKey).sort());
}

function pointKey(point: { readonly x: number; readonly y: number }): string {
  return `${Math.floor(point.x)},${Math.floor(point.y)}`;
}

function expectStageThreeIntentOnFinalSurface(
  result: ReturnType<typeof generateFiniteFloorTraceForTests>,
): void {
  const stage = result.trace.snapshots.find(({ stageId }) => stageId === "maze-fill");
  if (!stage) throw new Error("missing maze-fill stage");
  const movement = analyzeFloorMovement({ buffers: result.floor, spawn: result.floor.spawn }, result.floor.bounds);
  const transitionIndices = Array.from(stage.semantic, (_semantic, index) => index)
    .filter((index) => stage.semantic[index] === FLOOR_SEMANTIC.Transition);
  const invalidTransitions = transitionIndices.filter((index) =>
    !isMovementWalkable(result.floor, index) || movement.reachable[index] !== 1);
  const invalidConnectors = stage.connectors.filter((connector) => {
    const index = localIndex({ bounds: result.floor.bounds, x: connector.x, y: connector.y });
    return !isMovementWalkable(result.floor, index) || movement.reachable[index] !== 1;
  });
  expect(transitionIndices.length).toBeGreaterThan(0);
  expect(invalidTransitions).toEqual([]);
  expect(invalidConnectors).toEqual([]);
}

function floorAttempt(floor: ReturnType<typeof generateFiniteFloorTraceForTests>["floor"]) {
  return {
    buffers: floor,
    connectors: floor.connectors,
    routes: floor.routes,
    spawn: floor.spawn,
  };
}
