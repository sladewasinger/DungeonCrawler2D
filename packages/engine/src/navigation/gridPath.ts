import type { WorldView } from "../world/types.js";
import { STEP_UP } from "../core/constants.js";
import { stairRimBlocks } from "./stairTraversal.js";

/** A tile-centred waypoint returned by the shared navigation search. */
export interface GridPathStep {
  x: number;
  y: number;
  /** Whether movement into this tile should begin a jump. */
  jump: boolean;
}

export interface GridPathTransition {
  jump: boolean;
  /** Optional additional cost for this edge (for example, a jump). */
  cost?: number;
}

export interface GridPathOptions {
  /** Maximum number of nodes to expand before giving up. */
  maxExpansions?: number;
  /** Extra tiles searched around the rectangle between start and goal. */
  margin?: number;
  /** Maximum non-stair rise that can be jumped. */
  maxJumpRise?: number;
  /** Minimum rise that should request a jump, inclusive. */
  jumpThreshold?: number;
  /** Additional destination filter, useful for hazards or reserved tiles. */
  canEnter?: (x: number, y: number) => boolean;
  /** Override the default height/stair transition rules for a movement system. */
  canTraverse?: (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    fromGround: number,
    toGround: number,
    onStair: boolean,
  ) => GridPathTransition | null;
}

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
  readonly goalX: number;
  readonly goalY: number;
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly maxExpansions: number;
  readonly maxJumpRise: number;
  readonly jumpThreshold: number;
  readonly canEnter: (x: number, y: number) => boolean;
  readonly open: SearchNode[];
  readonly nodes: Map<string, SearchNode>;
  readonly bestG: Map<string, number>;
}

const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/**
 * Find a short cardinal route through a tile world.
 *
 * This is deliberately bounded: it is intended for occasional AI recovery
 * (corners, U-turns, and small elevation changes), not for global routing.
 * The engine owns the algorithm so enemies, pets, and future NPCs can share
 * the same movement semantics without depending on a game-server feature.
 */
export function findGridPath(
  world: WorldView,
  start: { x: number; y: number },
  goal: { x: number; y: number },
  options: GridPathOptions = {},
): GridPathStep[] {
  const startX = Math.floor(start.x);
  const startY = Math.floor(start.y);
  const goalX = Math.floor(goal.x);
  const goalY = Math.floor(goal.y);
  if (startX === goalX && startY === goalY) return [];
  const startNode: SearchNode = {
    key: `${startX},${startY}`,
    x: startX,
    y: startY,
    g: 0,
    f: 0,
    parent: undefined,
    jump: false,
  };
  const margin = options.margin ?? 8;
  const state: SearchState = {
    world,
    options,
    goalX,
    goalY,
    minX: Math.min(startX, goalX) - margin,
    maxX: Math.max(startX, goalX) + margin,
    minY: Math.min(startY, goalY) - margin,
    maxY: Math.max(startY, goalY) + margin,
    maxExpansions: options.maxExpansions ?? 640,
    maxJumpRise: options.maxJumpRise ?? Infinity,
    jumpThreshold: options.jumpThreshold ?? 0.5,
    canEnter: options.canEnter ?? ((x: number, y: number) => world.isWalkable(x, y)),
    open: [startNode],
    nodes: new Map([[startNode.key, startNode]]),
    bestG: new Map([[startNode.key, 0]]),
  };
  return searchPath(state, `${goalX},${goalY}`);
}

function searchPath(state: SearchState, goalKey: string): GridPathStep[] {
  let expansions = 0;
  while (state.open.length > 0 && expansions < state.maxExpansions) {
    const current = takeBestNode(state.open, state.bestG);
    if (!current) break;
    if (current.key === goalKey) return reconstructPath(state.nodes, current);
    expandNeighbors(state, current);
    expansions++;
  }
  return [];
}

function expandNeighbors(state: SearchState, current: SearchNode): void {
  for (const [dx, dy] of DIRECTIONS) {
    const next = neighborNode(state, current, dx, dy);
    if (next) state.open.push(next);
  }
}

function neighborNode(
  state: SearchState,
  current: SearchNode,
  dx: number,
  dy: number,
): SearchNode | undefined {
  const x = current.x + dx;
  const y = current.y + dy;
  if (!withinBounds(state, x, y) || !state.canEnter(x, y)) return undefined;
  const transition = neighborTransition(state, current, x, y);
  if (!transition) return undefined;
  const key = `${x},${y}`;
  const g = current.g + 1 + (transition.cost ?? 0);
  if (g >= (state.bestG.get(key) ?? Infinity)) return undefined;
  const next: SearchNode = {
    key,
    x,
    y,
    g,
    f: g + Math.abs(state.goalX - x) + Math.abs(state.goalY - y),
    parent: current.key,
    jump: transition.jump,
  };
  state.bestG.set(key, g);
  state.nodes.set(key, next);
  return next;
}

function withinBounds(state: SearchState, x: number, y: number): boolean {
  return x >= state.minX && x <= state.maxX && y >= state.minY && y <= state.maxY;
}

function neighborTransition(
  state: SearchState,
  current: SearchNode,
  x: number,
  y: number,
): GridPathTransition | null {
  const currentGround = state.world.groundAt(current.x + 0.5, current.y + 0.5);
  const nextGround = state.world.groundAt(x + 0.5, y + 0.5);
  const onStair = state.world.stairHeightAt(current.x + 0.5, current.y + 0.5) !== null ||
    state.world.stairHeightAt(x + 0.5, y + 0.5) !== null;
  // A stair is only traversable along its ramp axis. Its side is a real
  // ledge, and movement physics rejects entering it from that side; apply
  // the same boundary probe here so A* never emits an impossible waypoint.
  if (onStair && stairRimBlocks(
    state.world, current.x, current.y, x - current.x, y - current.y,
  )) return null;
  return state.options.canTraverse?.(
    current.x, current.y, x, y, currentGround, nextGround, onStair,
  ) ?? defaultTransition(nextGround - currentGround, onStair, state.maxJumpRise, state.jumpThreshold);
}

function defaultTransition(
  rise: number,
  onStair: boolean,
  maxJumpRise: number,
  jumpThreshold: number,
): GridPathTransition | null {
  if (!onStair && rise > maxJumpRise) return null;
  // STEP_UP is the collision cutoff for ordinary grounded movement. The
  // explicit threshold also covers authored half-height blocks (including
  // an exact 0.5 rise) and remains meaningful for callers that use a
  // different movement cutoff. Stairs remain ramp-walkable; a non-stair
  // block at the threshold is explicitly marked as a jump edge.
  const jump = !onStair && (rise >= jumpThreshold || rise > STEP_UP);
  return { jump, cost: jump ? 0.25 : 0 };
}

function takeBestNode(open: SearchNode[], bestG: Map<string, number>): SearchNode | undefined {
  let bestIndex = -1;
  let bestF = Infinity;
  for (let index = 0; index < open.length; index++) {
    const node = open[index];
    if (!node) continue;
    if (node.g !== bestG.get(node.key) || node.f >= bestF) continue;
    bestIndex = index;
    bestF = node.f;
  }
  return bestIndex < 0 ? undefined : open.splice(bestIndex, 1)[0];
}

function reconstructPath(nodes: Map<string, SearchNode>, goal: SearchNode): GridPathStep[] {
  const path: GridPathStep[] = [];
  let current: SearchNode | undefined = goal;
  while (current?.parent) {
    path.push({ x: current.x + 0.5, y: current.y + 0.5, jump: current.jump });
    current = nodes.get(current.parent);
  }
  return path.reverse();
}
