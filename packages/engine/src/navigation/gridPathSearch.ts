import type { WorldView } from "../world/types.js";
import { transitionAt } from "./gridPathTransition.js";
import type { GridPathOptions, GridPathRequest, GridPathStep } from "./gridPathTypes.js";

interface SearchNode {
  key: string;
  x: number;
  y: number;
  g: number;
  f: number;
  parent: string | undefined;
  jump: boolean;
}

interface SearchState {
  readonly world: WorldView;
  readonly options: GridPathOptions;
  readonly goal: SearchPoint;
  readonly bounds: SearchBounds;
  readonly limits: SearchLimits;
  readonly open: SearchNode[];
  readonly nodes: Map<string, SearchNode>;
  readonly bestG: Map<string, number>;
}

interface SearchPoint { x: number; y: number; }
interface SearchBounds { minX: number; maxX: number; minY: number; maxY: number; }
interface SearchLimits { maxExpansions: number; maxJumpRise: number; jumpThreshold: number; }
interface SearchRequest {
  world: WorldView;
  start: SearchPoint;
  goal: SearchPoint;
  options?: GridPathOptions;
}
interface NeighborRequest { current: SearchNode; next: SearchPoint; }
interface SaveNodeRequest { current: SearchNode; next: SearchPoint; key: string; g: number; jump: boolean; }

const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const nodeKey = (point: SearchPoint): string => `${point.x},${point.y}`;

export function searchGridPath(request: GridPathRequest): GridPathStep[] {
  const { world, start, goal, options = {} } = request as SearchRequest;
  if (samePoint(start, goal)) return [];
  const state = createSearchState({ world, start, goal, options });
  return runSearch(state);
}

function samePoint(left: SearchPoint, right: SearchPoint): boolean {
  return left.x === right.x && left.y === right.y;
}

function createSearchState(request: Required<SearchRequest>): SearchState {
  const { world, start, goal, options } = request;
  const node = createStartNode(start);
  return {
    world, options, goal, bounds: searchBounds(start, goal, options.margin ?? 8),
    limits: searchLimits(options), open: [node], nodes: new Map([[node.key, node]]),
    bestG: new Map([[node.key, 0]]),
  };
}

function createStartNode(point: SearchPoint): SearchNode {
  return { key: nodeKey(point), x: point.x, y: point.y, g: 0, f: 0, parent: undefined, jump: false };
}

function searchBounds(start: SearchPoint, goal: SearchPoint, margin: number): SearchBounds {
  return {
    minX: Math.min(start.x, goal.x) - margin, maxX: Math.max(start.x, goal.x) + margin,
    minY: Math.min(start.y, goal.y) - margin, maxY: Math.max(start.y, goal.y) + margin,
  };
}

function searchLimits(options: GridPathOptions): SearchLimits {
  return {
    maxExpansions: options.maxExpansions ?? 640,
    maxJumpRise: options.maxJumpRise ?? Infinity,
    jumpThreshold: options.jumpThreshold ?? 0.5,
  };
}

function runSearch(state: SearchState): GridPathStep[] {
  for (let expansions = 0; state.open.length > 0 && expansions < state.limits.maxExpansions; expansions++) {
    const result = expandBestNode(state);
    if (result) return result;
  }
  return [];
}

function expandBestNode(state: SearchState): GridPathStep[] | undefined {
  const current = takeBestNode(state.open, state.bestG);
  if (!current) return [];
  if (samePoint(current, state.goal)) return reconstructPath(state.nodes, current);
  expandNeighbors(state, current);
  return undefined;
}

function expandNeighbors(state: SearchState, current: SearchNode): void {
  for (const [dx, dy] of DIRECTIONS) {
    const next = neighborNode(state, { current, next: { x: current.x + dx, y: current.y + dy } });
    if (next) state.open.push(next);
  }
}

function neighborNode(state: SearchState, request: NeighborRequest): SearchNode | undefined {
  const { current, next } = request;
  if (!canVisit(state, next)) return undefined;
  const transition = transitionAt({ world: state.world, options: state.options, limits: state.limits, from: current, to: next });
  if (!transition) return undefined;
  const g = current.g + 1 + (transition.cost ?? 0);
  const key = nodeKey(next);
  if (g >= (state.bestG.get(key) ?? Infinity)) return undefined;
  return saveNode(state, { current, next, key, g, jump: transition.jump });
}

function canVisit(state: SearchState, point: SearchPoint): boolean {
  return withinBounds(state.bounds, point) && (state.options.canEnter?.(point) ?? state.world.isWalkable(point.x, point.y));
}

function withinBounds(bounds: SearchBounds, point: SearchPoint): boolean {
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
}

function saveNode(state: SearchState, request: SaveNodeRequest): SearchNode {
  const { current, next, key, g, jump } = request;
  const node = { key, x: next.x, y: next.y, g, f: g + distance(next, state.goal), parent: current.key, jump };
  state.bestG.set(key, g);
  state.nodes.set(key, node);
  return node;
}

function distance(left: SearchPoint, right: SearchPoint): number {
  return Math.abs(right.x - left.x) + Math.abs(right.y - left.y);
}

function takeBestNode(open: SearchNode[], bestG: Map<string, number>): SearchNode | undefined {
  let bestIndex = -1;
  for (let index = 0; index < open.length; index++) {
    const node = open[index];
    if (node && isBetterNode(node, open[bestIndex], bestG)) bestIndex = index;
  }
  return bestIndex < 0 ? undefined : open.splice(bestIndex, 1)[0];
}

function isBetterNode(node: SearchNode, best: SearchNode | undefined, bestG: Map<string, number>): boolean {
  return node.g === bestG.get(node.key) && (best === undefined || node.f < best.f);
}

function reconstructPath(nodes: Map<string, SearchNode>, goal: SearchNode): GridPathStep[] {
  const path: GridPathStep[] = [];
  for (let current: SearchNode | undefined = goal; current?.parent; current = nodes.get(current.parent)) {
    path.push({ x: current.x + 0.5, y: current.y + 0.5, jump: current.jump });
  }
  return path.reverse();
}
