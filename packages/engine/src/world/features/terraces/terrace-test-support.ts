// Shared test-only helpers for terraces.test.ts: a chunk-local synthetic
// base layout with a terrace applied (so the test doesn't depend on which
// generator is wired in as the engine's default), plus the walkability
// checks its assertions need.

import { expect } from "vitest";
import { STEP_UP } from "../../../core/constants.js";
import { applyTerrace, TERRACE_RISE } from "./terraces.js";
import { baseSample, corridorSegments, seedsFor } from "../../core/terrain.js";
import { TILE, TOPOLOGY } from "../../core/types.js";
import { GENERATION_CHUNK_SIZE as CHUNK_SIZE } from "../../generate/layout/scale.js";

export interface SyntheticChunk { tiles: Uint8Array; height: Float32Array }
type ChunkCoordinate = { worldSeed: number; floor: number; cx: number; cy: number }; type Cell = { x: number; y: number };

/** A chunk-local base layout (the same flat-first sampling the generators run) with the terrace applied on top. */
export function buildTerraceChunk(chunk: ChunkCoordinate): SyntheticChunk {
  const { worldSeed, floor, cx, cy } = chunk;
  const seeds = seedsFor(worldSeed, floor);
  const segs = corridorSegments(worldSeed, floor, cx, cy);
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  const height = new Float32Array(CHUNK_SIZE * CHUNK_SIZE);
  const baseX = cx * CHUNK_SIZE;
  const baseY = cy * CHUNK_SIZE;
  for (let index = 0; index < tiles.length; index++) {
    const lx = index % CHUNK_SIZE;
    const ly = Math.floor(index / CHUNK_SIZE);
    const sample = baseSample(seeds, segs, baseX + lx, baseY + ly);
    tiles[index] = sample.wall ? TOPOLOGY.Uncarved : TILE.Floor;
    height[index] = sample.height;
  }
  applyTerrace({ chunk, segs, tiles, height });
  return { tiles, height };
}

export interface ChunkLookup { tileAt(wx: number, wy: number): number; heightAt(wx: number, wy: number): number; isWalkable(wx: number, wy: number): boolean }

/** A minimal multi-chunk lookup, built from synthetic terrace chunks, for the cross-chunk walk test. */
export class TwoChunkView implements ChunkLookup {
  private readonly chunks = new Map<string, SyntheticChunk>();

  constructor(seed: number, floor: number, coords: Array<[number, number]>) {
    for (const [cx, cy] of coords) this.chunks.set(`${cx},${cy}`, buildTerraceChunk({ worldSeed: seed, floor, cx, cy }));
  }

  private cell(wx: number, wy: number): { chunk: SyntheticChunk; i: number } | null {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cy = Math.floor(wy / CHUNK_SIZE);
    const chunk = this.chunks.get(`${cx},${cy}`);
    if (!chunk) return null;
    const lx = wx - cx * CHUNK_SIZE;
    const ly = wy - cy * CHUNK_SIZE;
    return { chunk, i: ly * CHUNK_SIZE + lx };
  }

  tileAt(wx: number, wy: number): number {
    const c = this.cell(wx, wy);
    return c ? (c.chunk.tiles[c.i] ?? TOPOLOGY.Uncarved) : TOPOLOGY.Uncarved;
  }

  heightAt(wx: number, wy: number): number {
    const c = this.cell(wx, wy);
    return c ? (c.chunk.height[c.i] ?? 0) : 0;
  }

  isWalkable(wx: number, wy: number): boolean {
    return this.tileAt(wx, wy) !== TOPOLOGY.Uncarved;
  }
}

export function snapCenter(world: ChunkLookup, center: { x: number; y: number }): { x: number; y: number } {
  const cell = nearbyCells(center, 3).find(({ x, y }) => world.isWalkable(x, y) && world.tileAt(x, y) !== TOPOLOGY.Uncarved);
  if (cell) return cell;
  throw new Error(`no walkable tile near center ${center.x},${center.y}`);
}

function nearbyCells(center: Cell, radius: number): Cell[] {
  const width = radius * 2 + 1;
  return Array.from({ length: width ** 2 }, (_, index) => ({
    x: Math.round(center.x) + index % width - radius,
    y: Math.round(center.y) + Math.floor(index / width) - radius,
  }));
}

export interface TerraceRectSpec { lx: number; ly: number; hx: number; hy: number }

/** Count of raised-district floor tiles at TERRACE_RISE inside spec's rect (asserts as it counts). */
export function countRaisedFloors(tiles: Uint8Array, height: Float32Array, spec: TerraceRectSpec): number {
  return terraceCells(spec).filter((cell) => tiles[cell.y * CHUNK_SIZE + cell.x] === TILE.Floor).reduce((count, cell) => {
    expect(height[cell.y * CHUNK_SIZE + cell.x]).toBe(TERRACE_RISE);
    return count + 1;
  }, 0);
}

function terraceCells(spec: TerraceRectSpec): Cell[] {
  return nearbyCells({ x: spec.lx, y: spec.ly }, Math.max(spec.hx, spec.hy) - 1)
    .filter(({ x, y }) => Math.abs(x - spec.lx) < spec.hx && Math.abs(y - spec.ly) < spec.hy)
    .filter(({ x, y }) => inBounds(x, y));
}

const NEIGHBOR_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < CHUNK_SIZE && y < CHUNK_SIZE;
}

function neighborHeights(input: { tiles: Uint8Array; height: Float32Array; cell: Cell }): number[] {
  return NEIGHBOR_DIRS.map(([dx, dy]) => ({ x: input.cell.x + dx, y: input.cell.y + dy }))
    .filter((cell) => inBounds(cell.x, cell.y))
    .filter(({ x, y }) => input.tiles[y * CHUNK_SIZE + x] !== TOPOLOGY.Uncarved)
    .map(({ x, y }) => input.height[y * CHUNK_SIZE + x] ?? 0);
}

/** Whether a stair tile at (x, y) touches both a low tile and the terrace top. */
function isLinkedEntry(input: { tiles: Uint8Array; height: Float32Array; cell: Cell }): boolean {
  const heights = neighborHeights(input);
  const [low, high] = [heights.some((h) => h <= 0.01), heights.some((h) => Math.abs(h - TERRACE_RISE) < 0.01)];
  return low && high;
}

/** Asserts every stair tile is a valid boundary entry step; returns counts. */
export function checkStairEntries(
  tiles: Uint8Array,
  height: Float32Array,
  spec: TerraceRectSpec,
): { stairs: number; linked: number } {
  const stairs = allChunkCells().filter(({ x, y }) => tiles[y * CHUNK_SIZE + x] === TILE.Stairs);
  const linked = stairs.filter((cell) => assertStairEntry({ tiles, height, spec, cell })).length;
  return { stairs: stairs.length, linked };
}

function allChunkCells(): Cell[] { return Array.from({ length: CHUNK_SIZE ** 2 }, (_, index) => ({ x: index % CHUNK_SIZE, y: Math.floor(index / CHUNK_SIZE) })); }

function assertStairEntry(input: { tiles: Uint8Array; height: Float32Array; spec: TerraceRectSpec; cell: Cell }): boolean {
  const { tiles, height, spec, cell } = input;
  const index = cell.y * CHUNK_SIZE + cell.x;
  const dx = Math.abs(cell.x - spec.lx);
  const dy = cell.y - spec.ly;
  const outsideEdge = (dx === spec.hx + 1 && Math.abs(dy) < spec.hy) || (dy === spec.hy + 1 && dx < spec.hx);
  expect(height[index]).toBe(TERRACE_RISE / 2);
  expect(outsideEdge, `step at ${cell.x},${cell.y} hugs an entry edge`).toBe(true);
  expect(dy, "no steps on the north side").not.toBe(-(spec.hy + 1));
  return isLinkedEntry({ tiles, height, cell });
}

export interface WalkBounds { minX: number; maxX: number; minY: number; maxY: number }

/** Whether (nx, ny) is a valid walking step from height curH (no wall-hop, rise capped).
 * A Stairs tile at either end ramps continuously in real physics
 * (stairRampAt), so this discrete per-tile check — which only sees a
 * tile's own resting height — must not gate on STEP_UP there: the real
 * body walks it smoothly regardless of the raw height delta. */
function canWalkOnto(input: { world: ChunkLookup; bounds: WalkBounds; current: Cell; next: Cell }): boolean {
  const { world, bounds, current, next } = input;
  if (!isInWalkBounds(bounds, next) || !world.isWalkable(next.x, next.y)) return false;
  const nextTile = world.tileAt(next.x, next.y);
  if (nextTile === TOPOLOGY.Uncarved) return false;
  if (world.tileAt(current.x, current.y) === TILE.Stairs || nextTile === TILE.Stairs) return true;
  return world.heightAt(next.x, next.y) - world.heightAt(current.x, current.y) <= STEP_UP;
}

function isInWalkBounds(bounds: WalkBounds, cell: Cell): boolean {
  return cell.x >= bounds.minX && cell.y >= bounds.minY && cell.x <= bounds.maxX && cell.y <= bounds.maxY;
}

export function walkableReachable(world: ChunkLookup, start: { x: number; y: number }, bounds: WalkBounds): Set<string> {
  const reached = new Set<string>([`${start.x},${start.y}`]);
  const queue = [start];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    if (!cur) continue;
    for (const next of reachableNeighbors({ world, bounds, current: cur, reached })) {
      reached.add(`${next.x},${next.y}`);
      queue.push(next);
    }
  }
  return reached;
}

function reachableNeighbors(input: { world: ChunkLookup; bounds: WalkBounds; current: Cell; reached: Set<string> }): Cell[] {
  return NEIGHBOR_DIRS.map(([dx, dy]) => ({ x: input.current.x + dx, y: input.current.y + dy }))
    .filter((next) => !input.reached.has(`${next.x},${next.y}`))
    .filter((next) => canWalkOnto({ ...input, next }));
}
