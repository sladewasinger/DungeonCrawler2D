// Shared test-only helpers for terraces.test.ts: a chunk-local synthetic
// base layout with a terrace applied (so the test doesn't depend on which
// generator is wired in as the engine's default), plus the walkability
// checks its assertions need.

import { expect } from "vitest";
import { STEP_UP } from "../../core/constants.js";
import { applyTerrace, TERRACE_RISE } from "./terraces.js";
import { baseSample, corridorSegments, seedsFor } from "../terrain.js";
import { CHUNK_SIZE, TILE } from "../types.js";

export interface SyntheticChunk {
  tiles: Uint8Array;
  height: Float32Array;
}

/** A chunk-local base layout (the same flat-first sampling the generators run) with the terrace applied on top. */
export function buildTerraceChunk(seed: number, floor: number, cx: number, cy: number): SyntheticChunk {
  const seeds = seedsFor(seed, floor);
  const segs = corridorSegments(seed, floor, cx, cy);
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  const height = new Float32Array(CHUNK_SIZE * CHUNK_SIZE);
  const baseX = cx * CHUNK_SIZE;
  const baseY = cy * CHUNK_SIZE;
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const sample = baseSample(seeds, segs, baseX + lx, baseY + ly);
      tiles[ly * CHUNK_SIZE + lx] = sample.wall ? TILE.Wall : TILE.Floor;
      height[ly * CHUNK_SIZE + lx] = sample.height;
    }
  }
  applyTerrace(seed, floor, cx, cy, segs, tiles, height);
  return { tiles, height };
}

export interface ChunkLookup {
  tileAt(wx: number, wy: number): number;
  heightAt(wx: number, wy: number): number;
  isWalkable(wx: number, wy: number): boolean;
}

/** A minimal multi-chunk lookup, built from synthetic terrace chunks, for the cross-chunk walk test. */
export class TwoChunkView implements ChunkLookup {
  private readonly chunks = new Map<string, SyntheticChunk>();

  constructor(seed: number, floor: number, coords: Array<[number, number]>) {
    for (const [cx, cy] of coords) this.chunks.set(`${cx},${cy}`, buildTerraceChunk(seed, floor, cx, cy));
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
    return c ? (c.chunk.tiles[c.i] ?? TILE.Wall) : TILE.Wall;
  }

  heightAt(wx: number, wy: number): number {
    const c = this.cell(wx, wy);
    return c ? (c.chunk.height[c.i] ?? 0) : 0;
  }

  isWalkable(wx: number, wy: number): boolean {
    return this.tileAt(wx, wy) !== TILE.Wall;
  }
}

export function snapCenter(world: ChunkLookup, center: { x: number; y: number }): { x: number; y: number } {
  for (let r = 0; r < 4; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = Math.round(center.x) + dx;
        const y = Math.round(center.y) + dy;
        if (world.isWalkable(x, y) && world.tileAt(x, y) !== TILE.Wall) return { x, y };
      }
    }
  }
  throw new Error(`no walkable tile near center ${center.x},${center.y}`);
}

export interface TerraceRectSpec {
  lx: number;
  ly: number;
  hx: number;
  hy: number;
}

/** Count of raised-district floor tiles at TERRACE_RISE inside spec's rect (asserts as it counts). */
export function countRaisedFloors(tiles: Uint8Array, height: Float32Array, spec: TerraceRectSpec): number {
  let raisedFloors = 0;
  for (let dy = -spec.hy + 1; dy <= spec.hy - 1; dy++) {
    for (let dx = -spec.hx + 1; dx <= spec.hx - 1; dx++) {
      const x = spec.lx + dx;
      const y = spec.ly + dy;
      if (x < 0 || y < 0 || x >= CHUNK_SIZE || y >= CHUNK_SIZE) continue;
      const i = y * CHUNK_SIZE + x;
      if (tiles[i] !== TILE.Floor) continue;
      expect(height[i]).toBe(TERRACE_RISE);
      raisedFloors++;
    }
  }
  return raisedFloors;
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

function neighborHeights(tiles: Uint8Array, height: Float32Array, x: number, y: number): number[] {
  const heights: number[] = [];
  for (const [ddx, ddy] of NEIGHBOR_DIRS) {
    const nx = x + ddx;
    const ny = y + ddy;
    if (!inBounds(nx, ny)) continue;
    const i = ny * CHUNK_SIZE + nx;
    if (tiles[i] !== TILE.Wall) heights.push(height[i] ?? 0);
  }
  return heights;
}

/** Whether a stair tile at (x, y) touches both a low tile and the terrace top. */
function isLinkedEntry(tiles: Uint8Array, height: Float32Array, x: number, y: number): boolean {
  const heights = neighborHeights(tiles, height, x, y);
  const low = heights.some((h) => h <= 0.01);
  const high = heights.some((h) => Math.abs(h - TERRACE_RISE) < 0.01);
  return low && high;
}

/** Asserts every stair tile is a valid boundary entry step; returns counts. */
export function checkStairEntries(
  tiles: Uint8Array,
  height: Float32Array,
  spec: TerraceRectSpec,
): { stairs: number; linked: number } {
  let stairs = 0;
  let linked = 0;
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const i = ly * CHUNK_SIZE + lx;
      if (tiles[i] !== TILE.Stairs) continue;
      stairs++;
      expect(height[i]).toBe(TERRACE_RISE / 2);
      const dx = Math.abs(lx - spec.lx);
      const dy = ly - spec.ly;
      const outsideEdge =
        (dx === spec.hx + 1 && Math.abs(dy) < spec.hy) || // east/west
        (dy === spec.hy + 1 && dx < spec.hx); // south
      expect(outsideEdge, `step at ${lx},${ly} hugs an entry edge`).toBe(true);
      expect(dy, "no steps on the north side").not.toBe(-(spec.hy + 1));
      if (isLinkedEntry(tiles, height, lx, ly)) linked++;
    }
  }
  return { stairs, linked };
}

export interface WalkBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Whether (nx, ny) is a valid walking step from height curH (no wall-hop, rise capped). */
function canWalkOnto(world: ChunkLookup, bounds: WalkBounds, curH: number, nx: number, ny: number): boolean {
  if (nx < bounds.minX || ny < bounds.minY || nx > bounds.maxX || ny > bounds.maxY) return false;
  if (!world.isWalkable(nx, ny)) return false;
  if (world.tileAt(nx, ny) === TILE.Wall) return false; // walking, not jumping
  return world.heightAt(nx, ny) - curH <= STEP_UP;
}

export function walkableReachable(world: ChunkLookup, start: { x: number; y: number }, bounds: WalkBounds): Set<string> {
  const reached = new Set<string>([`${start.x},${start.y}`]);
  const queue = [start];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    if (!cur) continue;
    const curH = world.heightAt(cur.x, cur.y);
    for (const [dx, dy] of NEIGHBOR_DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const key = `${nx},${ny}`;
      if (reached.has(key) || !canWalkOnto(world, bounds, curH, nx, ny)) continue;
      reached.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return reached;
}
