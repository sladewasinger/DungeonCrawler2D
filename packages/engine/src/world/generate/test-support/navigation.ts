import { STEP_UP } from "../../../core/constants.js";
import { stairRampAt, type StairView } from "../../stairs/stairs.js";
import { CHUNK_SIZE, TILE, TOPOLOGY, type Chunk } from "../../core/types.js";
import { type ChunkCoordinate, type GenerationScope, type WorldPoint } from "./types.js";
import { generateChunk } from "../index.js";

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function chunkAt(scope: GenerationScope, coordinate: ChunkCoordinate): Chunk {
  const key = `${coordinate.cx},${coordinate.cy}`;
  const cached = scope.cache.get(key);
  if (cached) return cached;
  const chunk = generateChunk({ worldSeed: scope.seed, floor: scope.floor, ...coordinate });
  scope.cache.set(key, chunk);
  return chunk;
}

export function anyFloorTile(scope: GenerationScope, coordinate: ChunkCoordinate): WorldPoint | null {
  const chunk = chunkAt(scope, coordinate);
  for (let index = 0; index < chunk.tiles.length; index++) {
    if (!isBlockedTile(chunk.tiles[index])) return pointAt(coordinate, index);
  }
  return null;
}

export function keyInChunk(key: string, coordinate: ChunkCoordinate): boolean {
  const point = keyToPoint(key);
  return chunkCoordinate(point).cx === coordinate.cx && chunkCoordinate(point).cy === coordinate.cy;
}

export function reachesNeighborChunk(scope: GenerationScope, start: WorldPoint): boolean {
  const origin = chunkCoordinate(start);
  const view = chunkView(scope);
  return searchToNeighbor({ origin, start, view });
}

export function bfsChunks(scope: GenerationScope, start: WorldPoint, chunkRange: number): Set<string> {
  const view = chunkView(scope);
  const bounds = boundsAround(start, chunkRange);
  return searchWithinBounds({ start, view, bounds });
}

function searchToNeighbor(input: { readonly origin: ChunkCoordinate; readonly start: WorldPoint; readonly view: StairView }): boolean {
  const reached = new Set<string>([pointKey(input.start)]);
  const queue = [input.start];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    if (!current) continue;
    const result = visitNeighbors({ current, view: input.view, reached, origin: input.origin });
    if (result.reachesNeighbor) return true;
    queue.push(...result.points);
  }
  return false;
}

function searchWithinBounds(input: { readonly start: WorldPoint; readonly view: StairView; readonly bounds: Bounds }): Set<string> {
  const reached = new Set<string>([pointKey(input.start)]);
  const queue = [input.start];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    if (!current) continue;
    queue.push(...visitReachable({ current, view: input.view, reached, bounds: input.bounds }));
  }
  return reached;
}

function visitNeighbors(input: { readonly current: WorldPoint; readonly view: StairView; readonly reached: Set<string>; readonly origin: ChunkCoordinate }): NeighborVisit {
  const points: WorldPoint[] = [];
  for (const next of cardinalNeighbors(input.current)) {
    const outcome = neighborOutcome({ ...input, next });
    if (outcome === "neighbor") return { points, reachesNeighbor: true };
    if (outcome) points.push(outcome);
  }
  return { points, reachesNeighbor: false };
}

function neighborOutcome(input: { readonly current: WorldPoint; readonly next: WorldPoint; readonly view: StairView; readonly reached: Set<string>; readonly origin: ChunkCoordinate }): WorldPoint | "neighbor" | null {
  if (!canStep(input.view, input.current, input.next)) return null;
  if (!sameChunk(chunkCoordinate(input.next), input.origin)) return "neighbor";
  return markReached(input.reached, input.next) ? null : input.next;
}

function visitReachable(input: { readonly current: WorldPoint; readonly view: StairView; readonly reached: Set<string>; readonly bounds: Bounds }): WorldPoint[] {
  return cardinalNeighbors(input.current).filter((next) => {
    return inBounds(next, input.bounds) && canStep(input.view, input.current, next) && !markReached(input.reached, next);
  });
}

function markReached(reached: Set<string>, point: WorldPoint): boolean {
  const key = pointKey(point);
  if (reached.has(key)) return true;
  reached.add(key);
  return false;
}

function chunkView(scope: GenerationScope): StairView {
  return {
    tileAt: (x, y) => chunkValue({ scope, point: { x, y }, select: (chunk) => chunk.tiles, fallback: TILE.Void }),
    heightAt: (x, y) => chunkValue({ scope, point: { x, y }, select: (chunk) => chunk.height, fallback: 0 }),
  };
}

function chunkValue(input: ChunkValueInput): number {
  const coordinate = chunkCoordinate(input.point);
  const index = (input.point.y - coordinate.cy * CHUNK_SIZE) * CHUNK_SIZE + input.point.x - coordinate.cx * CHUNK_SIZE;
  return input.select(chunkAt(input.scope, coordinate))[index] ?? input.fallback;
}

function canStep(view: StairView, current: WorldPoint, next: WorldPoint): boolean {
  return !isBlockedTile(view.tileAt(next.x, next.y)) && groundAt(view, next) - groundAt(view, current) <= STEP_UP;
}

function groundAt(view: StairView, point: WorldPoint): number {
  return stairRampAt(view, point.x + 0.5, point.y + 0.5) ?? view.heightAt(point.x, point.y);
}

function isBlockedTile(tile: number | undefined): boolean { return tile === TILE.Void || tile === TOPOLOGY.Uncarved; }
function pointKey(point: WorldPoint): string { return `${point.x},${point.y}`; }
function keyToPoint(key: string): WorldPoint { const [x, y] = key.split(",").map(Number); return { x: x ?? 0, y: y ?? 0 }; }
function pointAt(coordinate: ChunkCoordinate, index: number): WorldPoint { const x = index % CHUNK_SIZE; return { x: coordinate.cx * CHUNK_SIZE + x, y: coordinate.cy * CHUNK_SIZE + (index - x) / CHUNK_SIZE }; }
function chunkCoordinate(point: WorldPoint): ChunkCoordinate { return { cx: Math.floor(point.x / CHUNK_SIZE), cy: Math.floor(point.y / CHUNK_SIZE) }; }
function sameChunk(a: ChunkCoordinate, b: ChunkCoordinate): boolean { return a.cx === b.cx && a.cy === b.cy; }
function cardinalNeighbors(point: WorldPoint): WorldPoint[] { return DIRECTIONS.map(([x, y]) => ({ x: point.x + x, y: point.y + y })); }

interface Bounds { readonly minX: number; readonly maxX: number; readonly minY: number; readonly maxY: number; }
interface NeighborVisit { readonly points: WorldPoint[]; readonly reachesNeighbor: boolean; }
interface ChunkValueInput { readonly scope: GenerationScope; readonly point: WorldPoint; readonly select: (chunk: Chunk) => Uint8Array | Float32Array; readonly fallback: number; }
function boundsAround(start: WorldPoint, range: number): Bounds {
  const origin = chunkCoordinate(start);
  return { minX: (origin.cx - range) * CHUNK_SIZE, maxX: (origin.cx + range + 1) * CHUNK_SIZE - 1, minY: (origin.cy - range) * CHUNK_SIZE, maxY: (origin.cy + range + 1) * CHUNK_SIZE - 1 };
}
function inBounds(point: WorldPoint, bounds: Bounds): boolean { return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY; }
