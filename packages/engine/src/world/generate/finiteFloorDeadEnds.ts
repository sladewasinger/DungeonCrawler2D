import { hash2D } from "../../core/rng.js";
import { isCarved, localIndex, stampSolid } from "./finiteFloorBuffers.js";
import type { GeneratedMazeSegment } from "./finiteFloorMazeGeneration.js";
import { FLOOR_SEMANTIC, type FloorBounds, type FloorBuffers, type FloorPoint } from "./finiteFloorTypes.js";

const BIOME_REMOVAL_SCALE = [0.55, 0.8, 0.65, 0.9] as const;

export interface DeadEndResult {
  readonly pruned: number;
  readonly retained: number;
}

/** Iteratively removes only unprotected broad corridor branches. */
export function pruneDeadEnds(input: {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly seed: number;
  readonly removalFraction: number;
  readonly segments: readonly GeneratedMazeSegment[];
}): DeadEndResult {
  const active = new Uint8Array(input.segments.length); active.fill(1);
  const retained = new Uint8Array(input.segments.length);
  const references = cellReferences(input.segments);
  const state = { active, retained, references };
  let pruned = 0;
  let changed = true;
  while (changed) {
    changed = prunePass(input, state);
    if (changed) pruned++;
  }
  return { pruned, retained: retained.reduce((sum, value) => sum + value, 0) };
}

function prunePass(input: Parameters<typeof pruneDeadEnds>[0], state: { readonly active: Uint8Array; readonly retained: Uint8Array; readonly references: Map<string, number> }): boolean {
  const degrees = endpointDegrees(input.segments, state.active);
  for (let index = 0; index < input.segments.length; index++) {
    const segment = input.segments[index];
    if (!segment || !state.active[index] || state.retained[index] || !isLeaf(segment, degrees)) continue;
    if (segmentIsProtected(input, segment)) { state.retained[index] = 1; continue; }
    if (!shouldPrune(input, segment)) { state.retained[index] = 1; continue; }
    removeSegment(input, segment, state.references);
    state.active[index] = 0;
    return true;
  }
  return false;
}

function endpointDegrees(segments: readonly GeneratedMazeSegment[], active: Uint8Array): Map<string, number> {
  const degrees = new Map<string, number>();
  segments.forEach((segment, index) => {
    if (!active[index]) return;
    increment(degrees, pointKey(segment.start));
    increment(degrees, pointKey(segment.end));
  });
  return degrees;
}

function isLeaf(segment: GeneratedMazeSegment, degrees: ReadonlyMap<string, number>): boolean {
  return degrees.get(pointKey(segment.start)) === 1 || degrees.get(pointKey(segment.end)) === 1;
}

function segmentIsProtected(input: Parameters<typeof pruneDeadEnds>[0], segment: GeneratedMazeSegment): boolean {
  return segment.cells.some((point) => input.buffers.protectedCells[localIndex({ bounds: input.bounds, ...point })] === 1);
}

function shouldPrune(input: Parameters<typeof pruneDeadEnds>[0], segment: GeneratedMazeSegment): boolean {
  const point = leafPoint(segment);
  const biome = input.buffers.biome[localIndex({ bounds: input.bounds, ...point })] ?? 0;
  const threshold = input.removalFraction * (BIOME_REMOVAL_SCALE[biome] ?? 0.7);
  return hash2D(input.seed, point.x, point.y) / 0x1_0000_0000 < threshold;
}

function leafPoint(segment: GeneratedMazeSegment): FloorPoint {
  return hash2D(segment.regionId, segment.start.x, segment.start.y) % 2 === 0 ? segment.start : segment.end;
}

function removeSegment(input: Parameters<typeof pruneDeadEnds>[0], segment: GeneratedMazeSegment, references: Map<string, number>): void {
  for (const point of segment.cells) {
    const key = pointKey(point);
    const count = references.get(key) ?? 0;
    references.set(key, Math.max(0, count - 1));
    if (count > 1) continue;
    const index = localIndex({ bounds: input.bounds, ...point });
    if (!removableCorridor(input.buffers, index)) continue;
    stampSolid({ buffers: input.buffers, bounds: input.bounds, ...point });
    input.buffers.region[index] = 0;
  }
}

function removableCorridor(buffers: FloorBuffers, index: number): boolean {
  return isCarved(buffers, index) && corridorCellOpen(buffers, index)
    && (buffers.semantic[index] ?? FLOOR_SEMANTIC.Solid) === FLOOR_SEMANTIC.Corridor;
}
function corridorCellOpen(buffers: FloorBuffers, index: number): boolean {
  return !(buffers.protectedCells[index] ?? 0) && (buffers.roomIds[index] ?? -1) < 0
    && (buffers.roomWallIds[index] ?? -1) < 0 && (buffers.features[index] ?? 0) === 0;
}

function cellReferences(segments: readonly GeneratedMazeSegment[]): Map<string, number> {
  const references = new Map<string, number>();
  for (const segment of segments) {
    for (const point of segment.cells) increment(references, pointKey(point));
  }
  return references;
}

function increment(values: Map<string, number>, key: string): void {
  values.set(key, (values.get(key) ?? 0) + 1);
}

function pointKey(point: FloorPoint): string { return `${point.x},${point.y}`; }
