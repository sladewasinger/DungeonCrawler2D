/** Bounded tile-grid A* pathfinding over chunk terrain, stairs, and blocking props/chests. */
import { GroundKind } from "../world/types.js";
import { WorldChunkCache, type BlockingObstacle } from "../world/collision.js";
import { createOpenHeap, popOpen, pushOpen, type OpenHeap } from "./pathHeap.js";

export interface TileWaypoint { readonly x: number; readonly y: number; }
export interface PathResult { readonly waypoints: readonly TileWaypoint[]; readonly reachedGoal: boolean; readonly closestPoint: TileWaypoint; }
export interface PathQuery {
  readonly cache: WorldChunkCache;
  readonly startX: number;
  readonly startY: number;
  readonly goalX: number;
  readonly goalY: number;
  readonly agentRadius?: number;
  readonly maxRadiusTiles?: number;
  readonly maxNodes?: number;
}
interface CellSample { readonly blocked: boolean; readonly elevation: number; readonly stairs: boolean; readonly extraCost: number; }

interface SearchGrid {
  readonly cache: WorldChunkCache;
  readonly props: readonly BlockingObstacle[];
  readonly agentRadius: number;
  readonly minTx: number;
  readonly minTy: number;
  readonly side: number;
  readonly startTx: number;
  readonly startTy: number;
  readonly goalTx: number;
  readonly goalTy: number;
  readonly cells: Array<CellSample | undefined>;
}
interface SearchState {
  readonly grid: SearchGrid;
  readonly gScore: Float32Array;
  readonly parent: Int32Array;
  readonly closed: Uint8Array;
  readonly heap: OpenHeap;
}
const DEFAULT_RADIUS_TILES = 20;
const DEFAULT_MAX_NODES = 900;
const PROP_HARD_PAD = 0.34;
const PROP_SOFT_PAD = 0.22;
const WATER_STEP_PENALTY = 0.55;
const SQRT2 = Math.SQRT2;
const ALL_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

export function findTilePath(query: PathQuery): PathResult {
  const startTx = Math.floor(query.startX);
  const startTy = Math.floor(query.startY);
  const goalTx = Math.floor(query.goalX);
  const goalTy = Math.floor(query.goalY);
  if (startTx === goalTx && startTy === goalTy) {
    const pt = { x: query.goalX, y: query.goalY };
    return { waypoints: [pt], reachedGoal: true, closestPoint: pt };
  }
  const radius = query.maxRadiusTiles ?? DEFAULT_RADIUS_TILES;
  const side = radius * 2 + 1;
  const minTx = Math.min(startTx - 1, Math.max(Math.floor((startTx + goalTx) * 0.5) - radius, startTx - side + 2));
  const minTy = Math.min(startTy - 1, Math.max(Math.floor((startTy + goalTy) * 0.5) - radius, startTy - side + 2));
  const props = collectBlockingProps(query.cache, { sx: startTx + 0.5, sy: startTy + 0.5, gx: goalTx + 0.5, gy: goalTy + 0.5 });
  const grid: SearchGrid = {
    cache: query.cache, props, agentRadius: query.agentRadius ?? 0.36,
    minTx, minTy, side, startTx, startTy, goalTx, goalTy,
    cells: new Array<CellSample | undefined>(side * side),
  };
  return runAStarSearch(grid, query.maxNodes ?? DEFAULT_MAX_NODES);
}

function collectBlockingProps(
  cache: WorldChunkCache,
  pts: { readonly sx: number; readonly sy: number; readonly gx: number; readonly gy: number },
): BlockingObstacle[] {
  const seen = new Set<string>();
  const out: BlockingObstacle[] = [];
  for (const p of [...cache.blockingObstaclesNear(pts.sx, pts.sy), ...cache.blockingObstaclesNear(pts.gx, pts.gy)]) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

function sampleCell(grid: SearchGrid, lx: number, ly: number): CellSample {
  const idx = ly * grid.side + lx;
  const cached = grid.cells[idx];
  if (cached) return cached;
  const tx = grid.minTx + lx;
  const ty = grid.minTy + ly;
  const tile = grid.cache.tileAt(tx, ty);
  const propPenalty = evaluatePropCost(grid, tx, ty);
  const waterPenalty = tile.ground === GroundKind.ShallowWater ? WATER_STEP_PENALTY : 0;
  const sample: CellSample = {
    blocked: tile.ground === GroundKind.DeepWater || propPenalty < 0,
    elevation: tile.elevation,
    stairs: tile.stairs,
    extraCost: Math.max(0, propPenalty) + waterPenalty,
  };
  grid.cells[idx] = sample;
  return sample;
}

function singlePropPenalty(q: {
  readonly cx: number; readonly cy: number; readonly p: BlockingObstacle;
  readonly isGoal: boolean; readonly hardThresh: number; readonly softThresh: number;
}): number {
  const d = Math.hypot(q.cx - q.p.x, q.cy - q.p.y);
  if (!q.isGoal && d < q.p.radius + q.hardThresh) return -1;
  return d < q.p.radius + q.softThresh ? 1.35 : 0;
}

function evaluatePropCost(grid: SearchGrid, tx: number, ty: number): number {
  if (tx === grid.startTx && ty === grid.startTy) return 0;
  const isGoal = tx === grid.goalTx && ty === grid.goalTy;
  const hardThresh = Math.min(grid.agentRadius, PROP_HARD_PAD);
  const softThresh = grid.agentRadius + PROP_SOFT_PAD;
  let penalty = 0;
  for (const p of grid.props) {
    const pen = singlePropPenalty({ cx: tx + 0.5, cy: ty + 0.5, p, isGoal, hardThresh, softThresh });
    if (pen < 0) return -1;
    penalty = Math.max(penalty, pen);
  }
  return penalty;
}

function cardinalElevationPenalty(from: CellSample, to: CellSample, allowJump: boolean): number | null {
  if (to.blocked) return null;
  const delta = Math.abs(from.elevation - to.elevation);
  if (delta === 0) return 0;
  if (delta !== 1) return null;
  if (from.stairs || to.stairs) return 0;
  return allowJump ? 1.6 : null;
}

function canStepDiagonal(q: {
  readonly grid: SearchGrid; readonly fx: number; readonly fy: number;
  readonly nx: number; readonly ny: number; readonly from: CellSample; readonly to: CellSample;
}): boolean {
  const fX = sampleCell(q.grid, q.nx, q.fy);
  const fY = sampleCell(q.grid, q.fx, q.ny);
  const ok = (a: CellSample, b: CellSample) => cardinalElevationPenalty(a, b, false) !== null;
  return ok(q.from, fX) && ok(q.from, fY) && ok(fX, q.to) && ok(fY, q.to);
}

function inBounds(side: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < side && y < side;
}

function stepCost(q: {
  readonly grid: SearchGrid; readonly fx: number; readonly fy: number; readonly nx: number; readonly ny: number;
}): number | null {
  if (!inBounds(q.grid.side, q.nx, q.ny)) return null;
  const from = sampleCell(q.grid, q.fx, q.fy);
  const to = sampleCell(q.grid, q.nx, q.ny);
  if (q.fx === q.nx || q.fy === q.ny) {
    const jumpPen = cardinalElevationPenalty(from, to, true);
    return jumpPen === null ? null : 1 + to.extraCost + jumpPen;
  }
  return canStepDiagonal({ ...q, from, to }) ? SQRT2 + to.extraCost : null;
}

function runAStarSearch(grid: SearchGrid, maxNodes: number): PathResult {
  const total = grid.side * grid.side;
  const s: SearchState = {
    grid, gScore: new Float32Array(total).fill(Infinity), parent: new Int32Array(total).fill(-1),
    closed: new Uint8Array(total), heap: createOpenHeap(total),
  };
  const sLx = grid.startTx - grid.minTx;
  const sLy = grid.startTy - grid.minTy;
  const gLx = grid.goalTx - grid.minTx;
  const gLy = grid.goalTy - grid.minTy;
  const startIdx = sLy * grid.side + sLx;
  s.gScore[startIdx] = 0;
  pushOpen(s.heap, startIdx, octileDist(Math.abs(gLx - sLx), Math.abs(gLy - sLy)));
  return searchLoop(s, { maxNodes, startIdx, gLx, gLy, bestDist: Math.hypot(gLx - sLx, gLy - sLy) });
}

function popUnvisited(s: SearchState): number | null {
  while (s.heap.size > 0) {
    const idx = popOpen(s.heap);
    if (!s.closed[idx]) return idx;
  }
  return null;
}

function closerCandidate(
  cur: { readonly curIdx: number; readonly cx: number; readonly cy: number },
  best: { idx: number; dist: number },
  goal: { readonly gLx: number; readonly gLy: number },
): void {
  const dist = Math.hypot(goal.gLx - cur.cx, goal.gLy - cur.cy);
  if (dist < best.dist - 0.001) {
    best.dist = dist;
    best.idx = cur.curIdx;
  }
}

function searchLoop(
  s: SearchState,
  opts: { readonly maxNodes: number; readonly startIdx: number; readonly gLx: number; readonly gLy: number; readonly bestDist: number },
): PathResult {
  const best = { idx: opts.startIdx, dist: opts.bestDist };
  for (let expanded = 0; expanded < opts.maxNodes; expanded++) {
    const curIdx = popUnvisited(s);
    if (curIdx === null) break;
    s.closed[curIdx] = 1;
    const cx = curIdx % s.grid.side;
    const cy = Math.floor(curIdx / s.grid.side);
    if (cx === opts.gLx && cy === opts.gLy) {
      return { waypoints: reconstructPath(s, curIdx), reachedGoal: true, closestPoint: toCenter(s.grid, curIdx) };
    }
    closerCandidate({ curIdx, cx, cy }, best, opts);
    expandCell(s, curIdx, { cx, cy, gLx: opts.gLx, gLy: opts.gLy });
  }
  return { waypoints: reconstructPath(s, best.idx), reachedGoal: false, closestPoint: toCenter(s.grid, best.idx) };
}

function expandCell(
  s: SearchState, curIdx: number,
  c: { readonly cx: number; readonly cy: number; readonly gLx: number; readonly gLy: number },
): void {
  const baseG = s.gScore[curIdx] ?? 0;
  for (const [dx, dy] of ALL_DIRS) {
    const nx = c.cx + dx;
    const ny = c.cy + dy;
    const cost = stepCost({ grid: s.grid, fx: c.cx, fy: c.cy, nx, ny });
    if (cost === null) continue;
    const nIdx = ny * s.grid.side + nx;
    if (s.closed[nIdx]) continue;
    const nextG = baseG + cost;
    if (nextG >= (s.gScore[nIdx] ?? Infinity)) continue;
    s.gScore[nIdx] = nextG;
    s.parent[nIdx] = curIdx;
    pushOpen(s.heap, nIdx, nextG + octileDist(Math.abs(c.gLx - nx), Math.abs(c.gLy - ny)));
  }
}

function octileDist(dx: number, dy: number): number {
  return (dx + dy) + (SQRT2 - 2) * Math.min(dx, dy);
}

function toCenter(grid: SearchGrid, idx: number): TileWaypoint {
  return { x: grid.minTx + (idx % grid.side) + 0.5, y: grid.minTy + Math.floor(idx / grid.side) + 0.5 };
}

function reconstructPath(s: SearchState, endIdx: number): TileWaypoint[] {
  const raw: TileWaypoint[] = [];
  let cur = endIdx;
  while (cur >= 0 && (s.parent[cur] ?? -1) !== -1) {
    raw.push(toCenter(s.grid, cur));
    cur = s.parent[cur] ?? -1;
  }
  raw.reverse();
  return simplifyCollinear(raw);
}

function isCorner(prev: TileWaypoint | undefined, curr: TileWaypoint | undefined, next: TileWaypoint | undefined): boolean {
  if (!prev || !curr || !next) return false;
  return Math.sign(curr.x - prev.x) !== Math.sign(next.x - curr.x) || Math.sign(curr.y - prev.y) !== Math.sign(next.y - curr.y);
}

function simplifyCollinear(pts: readonly TileWaypoint[]): TileWaypoint[] {
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (pts.length <= 2 || !first || !last) return [...pts];
  const out: TileWaypoint[] = [first];
  for (let i = 1; i < pts.length - 1; i++) {
    const curr = pts[i];
    if (curr && isCorner(out[out.length - 1], curr, pts[i + 1])) out.push(curr);
  }
  return [...out, last];
}
