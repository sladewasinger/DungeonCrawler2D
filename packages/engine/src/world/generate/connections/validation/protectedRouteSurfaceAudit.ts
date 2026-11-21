import { analyzeFloorMovement } from "../../finiteFloorMovement.js";
import type { FloorAttempt, FloorBounds, FloorPoint, GeneratedConnector } from "../../finiteFloorTypes.js";
import { edgeDirection, edgeKey, pointKey, protectedSurfaceFailure, type RouteDirection } from "./protectedRouteSurfaceRules.js";

export interface ProtectedRouteSurfaceAudit {
  readonly routeCount: number;
  readonly routePointCount: number;
  readonly uniqueRouteCellCount: number;
  readonly totalEdgeCount: number;
  readonly uniqueEdgeCount: number;
  readonly repeatedEdgeCount: number;
  readonly duplicateEndpointCount: number;
  readonly connectorCount: number;
  readonly directionCounts: Readonly<Record<RouteDirection, number>>;
  readonly failureCount: number;
  readonly failures: readonly string[];
}

interface AuditInput {
  readonly attempt: {
    readonly buffers: FloorAttempt["buffers"];
    readonly connectors: readonly GeneratedConnector[];
    readonly routes: readonly (readonly FloorPoint[])[];
    readonly spawn: FloorPoint;
  };
  readonly bounds: FloorBounds;
  readonly movement?: ReturnType<typeof analyzeFloorMovement>;
}

interface AuditState {
  readonly cells: Set<string>;
  readonly edges: Set<string>;
  readonly endpoints: Map<string, number>;
  readonly failures: string[];
  readonly directions: Record<RouteDirection, number>;
  routePointCount: number;
  totalEdgeCount: number;
  failureCount: number;
}

export function auditProtectedRouteSurfaces(input: AuditInput): ProtectedRouteSurfaceAudit {
  const movement = input.movement ?? analyzeFloorMovement(input.attempt, input.bounds);
  const state = createAuditState();
  input.attempt.routes.forEach((route, routeIndex) => auditRoute({ input, movement, state, route, routeIndex }));
  input.attempt.connectors.forEach((connector, connectorIndex) => {
    auditConnector({ input, movement, state, connector, connectorIndex });
  });
  return auditResult(input, state);
}

function createAuditState(): AuditState {
  return {
    cells: new Set(), edges: new Set(), endpoints: new Map(), failures: [],
    directions: { east: 0, north: 0, south: 0, west: 0 },
    routePointCount: 0, totalEdgeCount: 0, failureCount: 0,
  };
}

function auditRoute(input: {
  readonly input: AuditInput;
  readonly movement: ReturnType<typeof analyzeFloorMovement>;
  readonly state: AuditState;
  readonly route: readonly FloorPoint[];
  readonly routeIndex: number;
}): void {
  const endpoint = input.route.at(-1);
  if (endpoint) incrementMap(input.state.endpoints, pointKey(endpoint));
  input.route.forEach((point, pointIndex) => {
    input.state.routePointCount++;
    input.state.cells.add(pointKey(point));
    auditSurface({ ...input, point, owner: `route ${input.routeIndex} point ${pointIndex}` });
    const previous = input.route[pointIndex - 1];
    if (previous) auditEdge({ ...input, from: previous, to: point, pointIndex });
  });
}

function auditConnector(input: {
  readonly input: AuditInput;
  readonly movement: ReturnType<typeof analyzeFloorMovement>;
  readonly state: AuditState;
  readonly connector: GeneratedConnector;
  readonly connectorIndex: number;
}): void {
  auditSurface({
    input: input.input, movement: input.movement, state: input.state,
    point: input.connector, owner: `connector ${input.connectorIndex}`,
  });
  if (!input.connector.protected) recordFailure(input.state, `connector ${input.connectorIndex} metadata is unprotected`);
}

function auditSurface(input: {
  readonly input: AuditInput;
  readonly movement: ReturnType<typeof analyzeFloorMovement>;
  readonly state: AuditState;
  readonly point: FloorPoint;
  readonly owner: string;
}): void {
  const reason = protectedSurfaceFailure({
    attempt: input.input.attempt, bounds: input.input.bounds,
    movement: input.movement, point: input.point,
  });
  if (reason) recordFailure(input.state, `${input.owner} at ${pointKey(input.point)} ${reason}`);
}

function auditEdge(input: {
  readonly input: AuditInput;
  readonly movement: ReturnType<typeof analyzeFloorMovement>;
  readonly state: AuditState;
  readonly routeIndex: number;
  readonly pointIndex: number;
  readonly from: FloorPoint;
  readonly to: FloorPoint;
}): void {
  input.state.totalEdgeCount++;
  input.state.edges.add(edgeKey(input.from, input.to));
  const direction = edgeDirection(input.from, input.to);
  if (!direction) {
    recordFailure(input.state, `route ${input.routeIndex} edge ${input.pointIndex - 1}->${input.pointIndex} is not cardinal`);
    return;
  }
  input.state.directions[direction]++;
  if (!input.movement.edgeIsLegal(input.from, input.to)) {
    recordFailure(input.state, `route ${input.routeIndex} edge ${pointKey(input.from)}->${pointKey(input.to)} is movement-illegal`);
  }
}

function auditResult(input: AuditInput, state: AuditState): ProtectedRouteSurfaceAudit {
  const duplicateEndpointCount = [...state.endpoints.values()].reduce((count, uses) => count + Math.max(0, uses - 1), 0);
  return {
    routeCount: input.attempt.routes.length,
    routePointCount: state.routePointCount,
    uniqueRouteCellCount: state.cells.size,
    totalEdgeCount: state.totalEdgeCount,
    uniqueEdgeCount: state.edges.size,
    repeatedEdgeCount: state.totalEdgeCount - state.edges.size,
    duplicateEndpointCount,
    connectorCount: input.attempt.connectors.length,
    directionCounts: { ...state.directions },
    failureCount: state.failureCount,
    failures: state.failures,
  };
}

function recordFailure(state: AuditState, failure: string): void {
  state.failureCount++;
  if (state.failures.length < 8) state.failures.push(failure);
}

function incrementMap(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}
