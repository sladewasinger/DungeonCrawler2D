import { TILE } from "../../core/types.js";
import { localIndex } from "../finiteFloorBuffers.js";
import { analyzeFloorMovement, type FloorMovementAnalysis } from "../finiteFloorMovement.js";
import { disconnectedWalkableCells } from "../connections/validation/finiteFloorRequiredConnectivity.js";
import type { FloorBounds, FloorBuffers, FloorPoint, FloorRect } from "../finiteFloorTypes.js";
import { pointInRect } from "./forestNoise.js";

export interface ForestConnectivityInput {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly spawn: FloorPoint;
  readonly sealedArenas: readonly FloorRect[];
}

interface SearchState {
  readonly input: ForestConnectivityInput;
  readonly movement: FloorMovementAnalysis;
  readonly dist: Int32Array;
  readonly parent: Int32Array;
  readonly currentWave: number[];
  readonly nextWave: number[];
}

const CARDINAL_DELTAS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
] as const;

export function ensureForestConnectivity(input: ForestConnectivityInput): void {
  const movement = analyzeFloorMovement({ buffers: input.buffers, spawn: input.spawn }, input.bounds);
  const arenaList = input.sealedArenas.map((bounds) => ({ bounds }));
  const disconnected = disconnectedWalkableCells({
    buffers: input.buffers,
    bounds: input.bounds,
    reachable: movement.reachable,
    sealedArenas: arenaList,
  });
  if (disconnected.length === 0) return;
  const parent = buildParentField(input, movement);
  for (const point of disconnected) {
    unblockPathToReachable(input, parent, localIndex({ bounds: input.bounds, ...point }));
  }
}

function buildParentField(input: ForestConnectivityInput, movement: FloorMovementAnalysis): Int32Array {
  const total = input.buffers.tiles.length;
  const dist = new Int32Array(total).fill(-1);
  const parent = new Int32Array(total).fill(-1);
  let wave = seedReachableWave(movement.reachable, dist);
  for (let depth = 0; wave.length > 0; depth++) {
    wave = expandWave({ input, movement, dist, parent, currentWave: wave, nextWave: [] }, depth);
  }
  return parent;
}

function seedReachableWave(reachable: Uint8Array, dist: Int32Array): number[] {
  const wave: number[] = [];
  for (let index = 0; index < reachable.length; index++) {
    if (!reachable[index]) continue;
    dist[index] = 0;
    wave.push(index);
  }
  return wave;
}

function expandWave(state: SearchState, depth: number): number[] {
  for (let cursor = 0; cursor < state.currentWave.length; cursor++) {
    const index = state.currentWave[cursor];
    if (index === undefined || state.dist[index] !== depth) continue;
    relaxNeighbors(state, index, depth);
  }
  return state.nextWave;
}

function relaxNeighbors(state: SearchState, index: number, depth: number): void {
  const { bounds } = state.input;
  const x = bounds.minX + (index % bounds.width);
  const y = bounds.minY + Math.floor(index / bounds.width);
  for (const delta of CARDINAL_DELTAS) {
    const nx = x + delta.x;
    const ny = y + delta.y;
    if (nx < bounds.minX || nx > bounds.maxX || ny < bounds.minY || ny > bounds.maxY) continue;
    tryRelaxNeighbor({ state, fromIndex: index, fromPoint: { x, y }, toPoint: { x: nx, y: ny }, depth });
  }
}

function tryRelaxNeighbor(step: {
  readonly state: SearchState;
  readonly fromIndex: number;
  readonly fromPoint: FloorPoint;
  readonly toPoint: FloorPoint;
  readonly depth: number;
}): void {
  const { state, fromIndex, fromPoint, toPoint, depth } = step;
  const toIndex = localIndex({ bounds: state.input.bounds, ...toPoint });
  if (!isRepairTraversable(state.input, toPoint, toIndex)) return;
  if (!state.movement.edgeIsLegal(toPoint, fromPoint)) return;
  const cost = isClearableObstacle(state.input.buffers.features[toIndex]) ? 1 : 0;
  const nextDist = depth + cost;
  const prevDist = state.dist[toIndex] ?? -1;
  if (prevDist >= 0 && prevDist <= nextDist) return;
  state.dist[toIndex] = nextDist;
  state.parent[toIndex] = fromIndex;
  (cost === 0 ? state.currentWave : state.nextWave).push(toIndex);
}

function isRepairTraversable(input: ForestConnectivityInput, point: FloorPoint, index: number): boolean {
  if (input.buffers.tiles[index] !== TILE.Floor) return false;
  if (input.sealedArenas.some((arena) => pointInRect(point, arena))) return false;
  const feature = input.buffers.features[index] ?? TILE.Floor;
  return feature === TILE.Floor
    || feature === TILE.Bridge
    || feature === TILE.Bush
    || feature === TILE.Stairs
    || isClearableObstacle(feature);
}

function isClearableObstacle(feature: number | undefined): boolean {
  return feature === TILE.Water || feature === TILE.Tree || feature === TILE.Boulder;
}

function unblockPathToReachable(input: ForestConnectivityInput, parent: Int32Array, start: number): void {
  let cursor = start;
  let guard = input.buffers.tiles.length;
  while (cursor >= 0 && guard-- > 0) {
    clearCellObstacle(input.buffers, cursor);
    cursor = parent[cursor] ?? -1;
  }
}

function clearCellObstacle(buffers: FloorBuffers, index: number): void {
  const feature = buffers.features[index] ?? TILE.Floor;
  if (feature === TILE.Water) buffers.features[index] = TILE.Bridge;
  else if (feature === TILE.Tree || feature === TILE.Boulder) buffers.features[index] = TILE.Floor;
}
