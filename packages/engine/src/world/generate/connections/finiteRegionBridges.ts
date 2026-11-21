/* eslint-disable max-lines -- bridge validation and transactional carving share one boundary. */
import { hash2D } from "../../../core/rng.js";
import { carveAt, insideBounds, isCarved, localIndex } from "../finiteFloorBuffers.js";
import { corridorCells } from "../finiteFloorMaze.js";
import { FLOOR_SEMANTIC, type FloorBounds, type FloorBuffers, type FloorPoint, type GeneratedFeatureStamp } from "../finiteFloorTypes.js";
import { carvedPaths } from "../finiteFloorPath.js";
import { createBridgeSearchWorkspace, findBridgeRoute, type BridgeSearchWorkspace } from "./bridges/finiteRegionBridgeSearch.js";
import { bridgeRoutes } from "./bridges/finiteRegionBridgeRoutes.js";

export interface RegionBridge {
  readonly regionIds: readonly [number, number];
  readonly endpoints: readonly [FloorPoint, FloorPoint];
  readonly position: FloorPoint;
}

export function preferredRegionConnectionPoints(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly features: readonly GeneratedFeatureStamp[]; readonly rooms: readonly { readonly regionId: number; readonly center: FloorPoint }[] }): ReadonlyMap<number, FloorPoint> {
  const points = new Map<number, FloorPoint>();
  for (const room of input.rooms) points.set(room.regionId, room.center);
  for (const feature of input.features) {
    const port = feature.ports[0];
    if (!port || !insideBounds({ bounds: input.bounds, ...port })) continue;
    const region = input.buffers.region[localIndex({ bounds: input.bounds, ...port })] ?? 0;
    if (region > 0) points.set(region, port);
  }
  return points;
}


export function regionRepresentatives(buffers: FloorBuffers, bounds: FloorBounds, preferred: ReadonlyMap<number, FloorPoint>): ReadonlyMap<number, FloorPoint> {
  const representatives = new Map(preferred);
  for (let y = bounds.minY + 1; y < bounds.maxY; y++) {
    for (let x = bounds.minX + 1; x < bounds.maxX; x++) {
      const index = localIndex({ bounds, x, y });
      const region = buffers.region[index] ?? 0;
      if (region > 0 && isCarved(buffers, index) && !representatives.has(region)) representatives.set(region, { x, y });
    }
  }
  return representatives;
}

export function nearestDisconnectedBridge(input: {
  readonly regions: readonly number[];
  readonly representatives: ReadonlyMap<number, FloorPoint>;
  readonly connected: (left: number, right: number) => boolean;
}): RegionBridge | null {
  const candidates = input.regions.flatMap((left, index) => {
    const leftPoint = input.representatives.get(left);
    if (!leftPoint) return [];
    return input.regions.slice(index + 1).flatMap((right) => {
      const rightPoint = input.representatives.get(right);
      return rightPoint && !input.connected(left, right)
        ? [bridge({ left, right, leftPoint, rightPoint })]
        : [];
    });
  });
  return candidates.toSorted(compareBridges)[0] ?? null;
}

export function carveRegionBridge(input: {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly seed: number;
  readonly width: number;
  readonly bridge: RegionBridge;
  readonly searchWorkspace?: BridgeSearchWorkspace;
}): boolean {
  const route = bridgeRoutes(input).find((points) => bridgeRouteAllowed(input, points))
    ?? findBridgeRoute({
      bounds: input.bounds,
      start: input.bridge.endpoints[0],
      target: input.bridge.endpoints[1],
      canUseLeg: (from, to) => bridgeLegAllowed(input, from, to),
      ...(input.searchWorkspace ? { workspace: input.searchWorkspace } : {}),
    });
  if (!route || !bridgeRouteAllowed(input, route)) return false;
  for (let index = 1; index < route.length; index++) {
    if (!carveLeg(input, route[index - 1] as FloorPoint, route[index] as FloorPoint)) return false;
  }
  return true;
}
export function connectRequiredTargets(input: {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly seed: number;
  readonly width: number;
  readonly widthMax?: number;
  readonly spawn: FloorPoint;
  readonly targets: readonly FloorPoint[];
}): readonly number[] {
  let pending = uniqueTargets(input.targets);
  const widths: number[] = [];
  const searchWorkspace = createBridgeSearchWorkspace(input.bounds);
  while (pending.length > 0) {
    const paths = carvedPaths({ buffers: input.buffers, bounds: input.bounds, from: input.spawn, targets: pending });
    const target = pending.find((_, index) => paths[index]?.length === 0);
    if (!target) return widths;
    const widthInput = { seed: input.seed, minimum: input.width, from: input.spawn, to: target };
    const width = bridgeWidth(input.widthMax === undefined ? widthInput : { ...widthInput, maximum: input.widthMax });
    const connected = carveRegionBridge({
      ...input,
      width,
      searchWorkspace,
      bridge: {
        endpoints: [input.spawn, target],
        position: target,
        regionIds: [regionAt(input, input.spawn), regionAt(input, target)],
      },
    });
    if (!connected) return widths;
    widths.push(width);
    pending = pending.filter((point) => point !== target);
  }
  return widths;
}
function uniqueTargets(targets: readonly FloorPoint[]): FloorPoint[] {
  const points = new Map<string, FloorPoint>();
  for (const target of targets) {
    const point = { x: Math.floor(target.x), y: Math.floor(target.y) };
    points.set(`${point.x},${point.y}`, point);
  }
  return [...points.values()].toSorted((left, right) => left.y - right.y || left.x - right.x);
}
function regionAt(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds }, point: FloorPoint): number {
  return input.buffers.region[localIndex({ bounds: input.bounds, ...point })] || 1;
}
function bridgeRouteAllowed(input: Parameters<typeof carveRegionBridge>[0], route: readonly FloorPoint[]): boolean {
  for (let index = 1; index < route.length; index++) {
    if (!bridgeLegAllowed(input, route[index - 1] as FloorPoint, route[index] as FloorPoint)) return false;
  }
  return true;
}
function bridgeLegAllowed(input: Parameters<typeof carveRegionBridge>[0], from: FloorPoint, to: FloorPoint): boolean {
  const direction = { x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) };
  if (direction.x === 0 && direction.y === 0) return false;
  if (Math.abs(to.x - from.x) + Math.abs(to.y - from.y) === 1) {
    return bridgeCrossSectionAllowed(input, from, direction);
  }
  return corridorCells({ start: from, end: to, direction, width: input.width }).every((point) => bridgeCellAllowed(input, point));
}

function bridgeCrossSectionAllowed(
  input: Parameters<typeof carveRegionBridge>[0],
  start: FloorPoint,
  direction: FloorPoint,
): boolean {
  const side = { x: -direction.y, y: direction.x };
  const lowOffset = -Math.floor((input.width - 1) / 2);
  for (let distance = 0; distance <= 1; distance++) {
    for (let offset = lowOffset; offset < lowOffset + input.width; offset++) {
      const point = {
        x: start.x + direction.x * distance + side.x * offset,
        y: start.y + direction.y * distance + side.y * offset,
      };
      if (!bridgeCellAllowed(input, point)) return false;
    }
  }
  return true;
}
function carveLeg(input: Parameters<typeof carveRegionBridge>[0], from: FloorPoint, to: FloorPoint): boolean {
  const direction = { x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) };
  if (direction.x === 0 && direction.y === 0) return true;
  if (!bridgeLegAllowed(input, from, to)) return false;
  for (const point of corridorCells({ start: from, end: to, direction, width: input.width })) {
    const index = localIndex({ bounds: input.bounds, ...point });
    const regionId = input.buffers.region[index] || input.bridge.regionIds[0];
    carveAt({ buffers: input.buffers, bounds: input.bounds, point, semantic: FLOOR_SEMANTIC.Transition, regionId });
    input.buffers.protectedCells[index] = 1;
  }
  return true;
}
function bridgeCellAllowed(input: Parameters<typeof carveRegionBridge>[0], point: FloorPoint): boolean {
  if (!insideBridgeBounds(input, point)) return false;
  const index = localIndex({ bounds: input.bounds, ...point });
  return (input.buffers.roomWallIds[index] ?? -1) < 0 && bridgeCellOpen(input, index);
}
function insideBridgeBounds(input: Parameters<typeof carveRegionBridge>[0], point: FloorPoint): boolean {
  return insideBounds({ bounds: input.bounds, ...point }) && point.x > input.bounds.minX && point.x < input.bounds.maxX
    && point.y > input.bounds.minY && point.y < input.bounds.maxY;
}
function bridgeCellOpen(input: Parameters<typeof carveRegionBridge>[0], index: number): boolean {
  return !(input.buffers.protectedCells[index] ?? 0) || isCarved(input.buffers, index);
}
function bridge(input: { readonly left: number; readonly right: number; readonly leftPoint: FloorPoint; readonly rightPoint: FloorPoint }): RegionBridge {
  return { regionIds: [input.left, input.right], endpoints: [input.leftPoint, input.rightPoint], position: { x: Math.floor((input.leftPoint.x + input.rightPoint.x) / 2), y: Math.floor((input.leftPoint.y + input.rightPoint.y) / 2) } };
}
function bridgeDistance(bridge: RegionBridge): number { return Math.abs(bridge.endpoints[0].x - bridge.endpoints[1].x) + Math.abs(bridge.endpoints[0].y - bridge.endpoints[1].y); }
function compareBridges(left: RegionBridge, right: RegionBridge): number { return bridgeDistance(left) - bridgeDistance(right) || left.regionIds[0] - right.regionIds[0] || left.regionIds[1] - right.regionIds[1]; }
function bridgeWidth(input: { readonly seed: number; readonly minimum: number; readonly maximum?: number; readonly from: FloorPoint; readonly to: FloorPoint }): number {
  const maximum = Math.max(input.minimum, input.maximum ?? input.minimum);
  const range = maximum - input.minimum + 1;
  return input.minimum + hash2D(input.seed, input.from.x + input.to.x, input.from.y + input.to.y) % Math.max(1, range);
}
