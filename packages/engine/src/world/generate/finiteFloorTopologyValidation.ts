import { forEachCell, insideBounds } from "./finiteFloorBuffers.js";
import { validateTerritories } from "./finiteFloorBiomeValidation.js";
import { isMovementWalkable, type FloorMovementAnalysis } from "./finiteFloorMovement.js";
import { isReachable, validateRequiredComponents } from "./connections/validation/finiteFloorRequiredConnectivity.js";
import type { FloorAttempt, FloorBounds, FloorBuffers, FloorPoint, NormalizedFloorGenerationConfig } from "./finiteFloorTypes.js";

export function validateTopologyInvariants(input: {
  readonly attempt: FloorAttempt;
  readonly bounds: FloorBounds;
  readonly config: NormalizedFloorGenerationConfig;
  readonly movement: FloorMovementAnalysis;
  readonly allowOptionalLoopShortfall?: boolean;
}): string[] {
  return [
    ...validateFeaturePortConnections(input.attempt),
    ...validateBoundary(input.attempt.buffers, input.bounds),
    ...validateRoomsAndConnectors(input),
    ...validateFeatureReservations(input),
    ...validateTerritories(input),
    ...validateLoopAndDeadEndPolicy(input),
    ...validateOrdinaryCorridorWidths(input),
    ...validateAuthoredTerritoryLayouts(input),
    ...validateRequiredComponents(input),
  ].slice(0, 24);
}

function validateFeaturePortConnections(attempt: FloorAttempt): string[] {
  return (attempt.featurePortFailures ?? []).map((failure) => `mandatory feature port is disconnected: ${failure}`);
}

function validateAuthoredTerritoryLayouts(input: Parameters<typeof validateTopologyInvariants>[0]): string[] {
  const metadataFailure = input.attempt.territoryLayouts.length === input.config.territoryRoster.length
    ? [] : ["territory layout metadata disagrees with configured roster"];
  return [...metadataFailure, ...input.attempt.territoryLayouts.flatMap(validateAuthoredTerritoryLayout)];
}

function validateAuthoredTerritoryLayout(layout: TerritoryLayout): string[] {
  if (layout.materialized === false) return [];
  const check = AUTHORED_LAYOUT_CHECKS[layout.layoutSignature];
  const failures = check && !check.accepts(layout) ? [check.failure] : [];
  if (!Object.values(layout.geometryMetrics).some((count) => count > 0)) {
    failures.push(`${layout.layoutSignature} has no materialized structural geometry`);
  }
  return failures;
}

type TerritoryLayout = FloorAttempt["territoryLayouts"][number];
const AUTHORED_LAYOUT_CHECKS: Readonly<Record<string, { readonly accepts: (layout: TerritoryLayout) => boolean; readonly failure: string }>> = {
  "workshop-clusters": { accepts: (layout) => (layout.geometryMetrics.workshops ?? 0) > 0 && (layout.geometryMetrics.fuseLinks ?? 0) > 0 && (layout.geometryMetrics.blastBays ?? 0) > 0, failure: "powderworks lacks workshop bays joined by fuse circulation" },
  "radial-brood-chambers": { accepts: (layout) => (layout.geometryMetrics.nestCores ?? 0) > 0 && (layout.geometryMetrics.ambushThroats ?? 0) > 0 && (layout.geometryMetrics.nestLoops ?? 0) > 0, failure: "broodcourt lacks nest cores, ambush throats, or nest loops" },
  "cell-block-guard-loops": { accepts: (layout) => (layout.geometryMetrics.cellBlocks ?? 0) > 0 && (layout.geometryMetrics.guardLoops ?? 0) > 0 && (layout.geometryMetrics.flankCorridors ?? 0) > 0, failure: "gaol lacks cell blocks, guard loops, or flank corridors" },
  "ritual-rings": { accepts: (layout) => (layout.geometryMetrics.ritualRings ?? 0) > 0 && (layout.geometryMetrics.ritualArms ?? 0) > 0 && layout.elevatedCells > 0, failure: "star chapel lacks concentric ritual rings or elevated focus" },
};

// eslint-disable-next-line complexity
function validateOrdinaryCorridorWidths(input: Parameters<typeof validateTopologyInvariants>[0]): string[] {
  const { ordinaryCorridorWidthMinimum: minimum, ordinaryCorridorWidthMaximum: maximum, ordinaryCorridorWidths: widths } = input.attempt.topology;
  const config = input.config;
  const failures: string[] = [];
  if (input.attempt.topology.mazeCorridorWidth !== config.mazeCorridorWidth) failures.push("maze lattice corridor width is not fixed to its configured value");
  if (!validWidthSamples(widths, config.ordinaryCorridorWidthMin, config.ordinaryCorridorWidthMax)) failures.push("ordinary corridor samples escape configured bounds");
  if (!Number.isFinite(minimum) || minimum < config.ordinaryCorridorWidthMin) failures.push("ordinary corridor width is below its configured minimum");
  if (!Number.isFinite(maximum) || maximum > config.ordinaryCorridorWidthMax) failures.push("ordinary corridor width exceeds its configured maximum");
  if (config.ordinaryCorridorWidthMin < config.ordinaryCorridorWidthMax && minimum === maximum) failures.push("ordinary corridor widths have no deterministic variation");
  return failures;
}

function validWidthSamples(widths: readonly number[], minimum: number, maximum: number): boolean {
  return widths.length > 0 && widths.every((width) => width >= minimum && width <= maximum);
}

function validateBoundary(buffers: FloorBuffers, bounds: FloorBounds): string[] {
  const failures: string[] = [];
  forEachCell(bounds, (x, y, index) => {
    if ((x === bounds.minX || x === bounds.maxX || y === bounds.minY || y === bounds.maxY)
      && isMovementWalkable(buffers, index)) failures.push(`finite floor boundary is walkable at ${x},${y}`);
  });
  return failures.slice(0, 2);
}

function validateRoomsAndConnectors(input: Parameters<typeof validateTopologyInvariants>[0]): string[] {
  const failures: string[] = [];
  for (const room of input.attempt.rooms) {
    if (!isReachable(room.center, input.movement.reachable, input.bounds)) failures.push(`room ${room.id} is unreachable`);
  }
  const expectedSpanning = Math.max(0, input.attempt.topology.regionCount - 1);
  if (input.attempt.topology.spanningConnectorCount !== expectedSpanning) failures.push(`region connector pass opened ${input.attempt.topology.spanningConnectorCount} of ${expectedSpanning} required merges`);
  if (input.attempt.topology.connectorCandidateCount <= expectedSpanning) failures.push("region connector pass found no optional candidates");
  for (const connector of input.attempt.connectors) failures.push(...validateConnector(input, connector));
  return failures.slice(0, 10);
}

function validateConnector(input: Parameters<typeof validateTopologyInvariants>[0], connector: FloorPoint & { readonly regionIds: readonly number[]; readonly protected: boolean }): string[] {
  const failures: string[] = [];
  if (!isReachable(connector, input.movement.reachable, input.bounds)) failures.push(`connector ${connector.x},${connector.y} is unreachable`);
  if (!validConnectorRegions(connector.regionIds)) failures.push("connector has invalid region IDs");
  if (!connector.protected) failures.push(`connector ${connector.x},${connector.y} is not protected`);
  return failures;
}

function validConnectorRegions(regions: readonly number[]): boolean {
  return regions.length >= 2 && regions.every((region) => region > 0)
    && new Set(regions).size === regions.length;
}

function validateFeatureReservations(input: Parameters<typeof validateTopologyInvariants>[0]): string[] {
  const failures: string[] = [];
  for (const feature of input.attempt.featureStamps) {
    failures.push(...validateFeature(input, feature));
  }
  return failures.slice(0, 10);
}

function validateFeature(input: Parameters<typeof validateTopologyInvariants>[0], feature: FloorAttempt["featureStamps"][number]): string[] {
  const failures: string[] = [];
  const points = [...feature.ports, ...feature.protectedCells];
  if (points.some((point) => !pointInside(input.bounds, point))) failures.push(`${feature.id} leaves finite bounds`);
  if (feature.ports.some((port) => !isReachable(port, input.movement.reachable, input.bounds))) failures.push(`${feature.id} port is unreachable`);
  return failures;
}

function pointInside(bounds: FloorBounds, point: FloorPoint): boolean {
  return insideBounds({ bounds, x: Math.floor(point.x), y: Math.floor(point.y) });
}

function validateLoopAndDeadEndPolicy(input: Parameters<typeof validateTopologyInvariants>[0]): string[] {
  const failures: string[] = [];
  const loops = input.attempt.connectors.filter((connector) => connector.loop);
  if (!input.allowOptionalLoopShortfall && loops.length < input.config.targetLoopCount) {
    failures.push("finite floor did not contain enough meaningful loops");
  }
  for (const loop of loops) failures.push(...validateLoop(input, loop));
  if (!loopsAreSpaced(loops, input.config.connectorSpacing)) failures.push("loop connectors violate configured spacing");
  if (input.attempt.topology.prunedDeadEndCount === 0) failures.push("dead-end policy pruned no corridor branches");
  if (input.attempt.topology.retainedDeadEndCount === 0) failures.push("dead-end policy retained no optional branches");
  return failures.slice(0, 8);
}

function loopsAreSpaced(loops: readonly FloorAttempt["connectors"][number][], spacing: number): boolean {
  return loops.every((loop, index) => loops.slice(index + 1).every((other) =>
    Math.abs(loop.x - other.x) > spacing || Math.abs(loop.y - other.y) > spacing));
}

function validateLoop(input: Parameters<typeof validateTopologyInvariants>[0], loop: FloorAttempt["connectors"][number]): string[] {
  const failures: string[] = [];
  if (loop.pathSaving < input.config.minimumLoopPathSaving) failures.push(`loop ${loop.x},${loop.y} was not path-saving when selected`);
  return failures;
}
