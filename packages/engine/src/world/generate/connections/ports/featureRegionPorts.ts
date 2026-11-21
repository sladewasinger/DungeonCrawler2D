import { carveAt, insideBounds, isCarved, localIndex } from "../../finiteFloorBuffers.js";
import { FLOOR_SEMANTIC, type FloorBounds, type FloorBuffers, type FloorPoint, type GeneratedFeatureStamp } from "../../finiteFloorTypes.js";
import { carveRegionBridge, type RegionBridge } from "../finiteRegionBridges.js";

interface FeatureBackboneInput {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly features: readonly GeneratedFeatureStamp[];
  readonly backboneRegionId: number;
  readonly spawn: FloorPoint;
  readonly seed: number;
  readonly width: number;
}

export interface FeaturePortConnectionResult {
  readonly regionLinks: readonly (readonly [number, number])[];
  readonly failures: readonly string[];
}

export function seedFeatureBackbone(input: FeatureBackboneInput): FeaturePortConnectionResult {
  seedBackboneCell(input);
  const regionLinks: (readonly [number, number])[] = [];
  const failures: string[] = [];
  input.features.forEach((feature, featureIndex) => {
    for (const [portIndex, port] of feature.ports.entries()) {
      const regionId = featureIndex + 1;
      const connected = connectFeaturePort({ ...input, feature, port, regionId, portIndex });
      if (!connected) failures.push(`${feature.id} port ${portIndex} has no seeded backbone route`);
      else regionLinks.push([input.backboneRegionId, regionId]);
    }
  });
  return { regionLinks, failures };
}

function seedBackboneCell(input: FeatureBackboneInput): void {
  if (!insideBounds({ bounds: input.bounds, ...input.spawn })) return;
  const index = localIndex({ bounds: input.bounds, ...input.spawn });
  if ((input.buffers.roomWallIds[index] ?? -1) >= 0) return;
  if (!isCarved(input.buffers, index)) carveAt({ buffers: input.buffers, bounds: input.bounds, point: input.spawn, semantic: FLOOR_SEMANTIC.Transition, regionId: input.backboneRegionId });
  input.buffers.protectedCells[index] = 1;
}

function connectFeaturePort(input: FeatureBackboneInput & { readonly feature: GeneratedFeatureStamp; readonly port: FloorPoint; readonly regionId: number; readonly portIndex: number }): boolean {
  const bridge: RegionBridge = { endpoints: [input.spawn, input.port], position: input.port, regionIds: [input.backboneRegionId, input.regionId] };
  const bridged = carveRegionBridge({ buffers: input.buffers, bounds: input.bounds, seed: input.seed + input.portIndex + input.regionId, width: Math.min(2, input.width), bridge });
  if (bridged) return true;
  const path = findSeededPath(input);
  if (!path) return false;
  for (const point of path) {
    const index = localIndex({ bounds: input.bounds, ...point });
    if (!isCarved(input.buffers, index)) carveAt({ buffers: input.buffers, bounds: input.bounds, point, semantic: FLOOR_SEMANTIC.Transition, regionId: input.backboneRegionId });
    input.buffers.protectedCells[index] = 1;
  }
  return true;
}

function findSeededPath(input: FeatureBackboneInput & { readonly port: FloorPoint }): FloorPoint[] | null {
  const state = seededPathState(input);
  while (state.cursor < state.queue.length && state.cursor < input.buffers.tiles.length) {
    const point = state.queue[state.cursor++];
    if (!point) continue;
    if (localIndex({ bounds: input.bounds, ...point }) === state.target) return restorePath({ ...state, bounds: input.bounds });
    expandSeededPath(input, state, point);
  }
  return null;
}

interface SeededPathState {
  readonly previous: Int32Array;
  readonly queue: FloorPoint[];
  readonly start: number;
  readonly target: number;
  cursor: number;
}

function seededPathState(input: FeatureBackboneInput & { readonly port: FloorPoint }): SeededPathState {
  const start = localIndex({ bounds: input.bounds, ...input.spawn });
  const previous = new Int32Array(input.buffers.tiles.length).fill(-1);
  previous[start] = start;
  return { previous, queue: [input.spawn], start, target: localIndex({ bounds: input.bounds, ...input.port }), cursor: 0 };
}

function expandSeededPath(input: FeatureBackboneInput, state: SeededPathState, point: FloorPoint): void {
  for (const direction of CARDINAL) {
    const next = { x: point.x + direction.x, y: point.y + direction.y };
    if (!insideBounds({ bounds: input.bounds, ...next })) continue;
    const index = localIndex({ bounds: input.bounds, ...next });
    if ((state.previous[index] ?? -1) >= 0 || !seedCellAllowed(input, index)) continue;
    state.previous[index] = localIndex({ bounds: input.bounds, ...point });
    state.queue.push(next);
  }
}

function seedCellAllowed(input: FeatureBackboneInput, index: number): boolean {
  return (input.buffers.roomWallIds[index] ?? -1) < 0 && (input.buffers.roomIds[index] ?? -1) < 0 && (!(input.buffers.protectedCells[index] ?? 0) || isCarved(input.buffers, index));
}

function restorePath(input: Pick<SeededPathState, "previous" | "start" | "target"> & { readonly bounds: FloorBounds }): FloorPoint[] {
  const path: FloorPoint[] = [];
  for (let cursor = input.target; cursor !== input.start; cursor = input.previous[cursor] ?? -1) path.push({ x: input.bounds.minX + cursor % input.bounds.width, y: input.bounds.minY + Math.floor(cursor / input.bounds.width) });
  path.push({ x: input.bounds.minX + input.start % input.bounds.width, y: input.bounds.minY + Math.floor(input.start / input.bounds.width) });
  return path.reverse();
}

const CARDINAL = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }] as const;
