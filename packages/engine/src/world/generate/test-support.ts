// Shared test-only helpers for this folder's *.test.ts files: a chunk cache
// (BFS across chunks would otherwise regenerate on every tile lookup), a
// border flood-fill mirroring pockets.ts's own reach seeds, and a
// height-aware BFS matching the REAL movement step rule (rise <= STEP_UP,
// drops free, continuous stairRampAt interpolation exactly like
// world/world.ts's groundAt) instead of a discrete per-tile approximation —
// a cruder "any move touching a Stairs tile is free" version used to hide
// exactly the kind of off-axis broken ramp docs/ROADMAP.md's Epic 7.13
// inescapable-pit bug shipped with (see stairsInvariant.test.ts).

import { STEP_UP } from "../../core/constants.js";
import { stairRampAt, type StairView } from "../stairs.js";
import { CHUNK_SIZE, TILE, type Chunk } from "../types.js";
import { generateChunk } from "./index.js";

export type ChunkCache = Map<string, Chunk>;

export interface WorldPoint {
  x: number;
  y: number;
}

export function chunkAt(seed: number, floor: number, cx: number, cy: number, cache: ChunkCache): Chunk {
  const key = `${cx},${cy}`;
  let chunk = cache.get(key);
  if (!chunk) {
    chunk = generateChunk(seed, floor, cx, cy);
    cache.set(key, chunk);
  }
  return chunk;
}

export function anyFloorTile(
  seed: number,
  floor: number,
  cx: number,
  cy: number,
  cache: ChunkCache,
): WorldPoint | null {
  const chunk = chunkAt(seed, floor, cx, cy, cache);
  for (let i = 0; i < chunk.tiles.length; i++) {
    if (chunk.tiles[i] === TILE.Wall) continue;
    const lx = i % CHUNK_SIZE;
    const ly = (i - lx) / CHUNK_SIZE;
    return { x: cx * CHUNK_SIZE + lx, y: cy * CHUNK_SIZE + ly };
  }
  return null;
}

export function keyInChunk(key: string, cx: number, cy: number): boolean {
  const [xs, ys] = key.split(",");
  const x = Number(xs);
  const y = Number(ys);
  return Math.floor(x / CHUNK_SIZE) === cx && Math.floor(y / CHUNK_SIZE) === cy;
}

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

interface Bounds {
  min: number;
  max: number;
  minY: number;
  maxY: number;
}

function boundsAround(start: WorldPoint, chunkRange: number): Bounds {
  const cx = Math.floor(start.x / CHUNK_SIZE);
  const cy = Math.floor(start.y / CHUNK_SIZE);
  return {
    min: (cx - chunkRange) * CHUNK_SIZE,
    max: (cx + chunkRange + 1) * CHUNK_SIZE - 1,
    minY: (cy - chunkRange) * CHUNK_SIZE,
    maxY: (cy + chunkRange + 1) * CHUNK_SIZE - 1,
  };
}

function inBounds(x: number, y: number, b: Bounds): boolean {
  return x >= b.min && x <= b.max && y >= b.minY && y <= b.maxY;
}

/** Cross-chunk StairView over the cache, for stairRampAt — the exact same continuous ramp world/world.ts's groundAt uses. */
function chunkView(seed: number, floor: number, cache: ChunkCache): StairView {
  const at = (arr: (c: Chunk) => Uint8Array | Float32Array, wx: number, wy: number, fallback: number): number => {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cy = Math.floor(wy / CHUNK_SIZE);
    const chunk = chunkAt(seed, floor, cx, cy, cache);
    const i = (wy - cy * CHUNK_SIZE) * CHUNK_SIZE + (wx - cx * CHUNK_SIZE);
    return arr(chunk)[i] ?? fallback;
  };
  return {
    tileAt: (wx, wy) => at((c) => c.tiles, wx, wy, TILE.Wall),
    heightAt: (wx, wy) => at((c) => c.height, wx, wy, 0),
  };
}

/** Real ground height at a tile's center: the continuous stair ramp where one applies, else the tile's resting height — matches world/world.ts's groundAt exactly. */
function groundAt(view: StairView, p: WorldPoint): number {
  return stairRampAt(view, p.x + 0.5, p.y + 0.5) ?? view.heightAt(p.x, p.y);
}

function canStep(view: StairView, cur: WorldPoint, next: WorldPoint): boolean {
  if (view.tileAt(next.x, next.y) === TILE.Wall) return false;
  return groundAt(view, next) - groundAt(view, cur) <= STEP_UP;
}

/** BFS over walkable tiles using the real continuous ramp rule (rise <= STEP_UP at tile centers, drops free), bounded to a chunkRange around start's chunk. */
export function bfsChunks(
  seed: number,
  floor: number,
  start: WorldPoint,
  chunkRange: number,
  cache: ChunkCache,
): Set<string> {
  const bounds = boundsAround(start, chunkRange);
  const view = chunkView(seed, floor, cache);
  const reached = new Set<string>([`${start.x},${start.y}`]);
  const queue: WorldPoint[] = [start];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    if (!cur) continue;
    for (const [dx, dy] of DIRS) {
      const next: WorldPoint = { x: cur.x + dx, y: cur.y + dy };
      if (!inBounds(next.x, next.y, bounds)) continue;
      const key = `${next.x},${next.y}`;
      if (reached.has(key)) continue;
      if (!canStep(view, cur, next)) continue;
      reached.add(key);
      queue.push(next);
    }
  }
  return reached;
}

/** Floor tiles that flood-fill should start from — mirrors pockets.ts's own reach seeds. */
function isReachSeed(tiles: Uint8Array, i: number): boolean {
  const lx = i % CHUNK_SIZE;
  const ly = (i - lx) / CHUNK_SIZE;
  const onBorder = lx === 0 || ly === 0 || lx === CHUNK_SIZE - 1 || ly === CHUNK_SIZE - 1;
  return onBorder || tiles[i] === TILE.Stairs || tiles[i] === TILE.DoorSafeRoom;
}

function orthoNeighbors(i: number): number[] {
  const lx = i % CHUNK_SIZE;
  const ly = (i - lx) / CHUNK_SIZE;
  return [
    lx > 0 ? i - 1 : -1,
    lx < CHUNK_SIZE - 1 ? i + 1 : -1,
    ly > 0 ? i - CHUNK_SIZE : -1,
    ly < CHUNK_SIZE - 1 ? i + CHUNK_SIZE : -1,
  ];
}

/** Reachability from every chunk-border/stairs/door tile, ignoring wall topology only. */
export function floodFromBorder(tiles: Uint8Array): Uint8Array {
  const reached = new Uint8Array(tiles.length);
  const queue: number[] = [];
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === TILE.Wall || !isReachSeed(tiles, i)) continue;
    reached[i] = 1;
    queue.push(i);
  }
  while (queue.length > 0) {
    const i = queue.pop();
    if (i === undefined) break;
    for (const n of orthoNeighbors(i)) {
      if (n < 0 || reached[n] === 1 || tiles[n] === TILE.Wall) continue;
      reached[n] = 1;
      queue.push(n);
    }
  }
  return reached;
}
