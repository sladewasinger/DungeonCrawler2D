import { WALL_RISE } from "@dc2d/engine";
import type { RescueWorld } from "./rescueWorld.js";

const HEIGHT_EPSILON = 0.01;
const CARDINAL_OFFSETS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

interface ReachabilitySearch {
  readonly world: RescueWorld;
  readonly origin: { readonly x: number; readonly y: number };
  readonly radius: number;
}

interface ReachabilityTraversal {
  readonly search: ReachabilitySearch;
  readonly reached: Set<string>;
  readonly queue: Array<{ x: number; y: number }>;
}

/** Tiles the player can already reach without needing the rescue action. */
export function reachableRescueTiles(
  search: ReachabilitySearch,
): ReadonlySet<string> {
  const start = {
    x: Math.floor(search.origin.x),
    y: Math.floor(search.origin.y),
  };
  const reached = new Set<string>([tileKey(start.x, start.y)]);
  const queue = [start];
  const traversal = { search, reached, queue };
  for (let head = 0; head < queue.length; head++) {
    const source = queue[head];
    if (source) visitReachableNeighbors(traversal, source);
  }
  return reached;
}

function visitReachableNeighbors(
  traversal: ReachabilityTraversal,
  source: { readonly x: number; readonly y: number },
): void {
  const { search, reached, queue } = traversal;
  for (const [dx, dy] of CARDINAL_OFFSETS) {
    const target = { x: source.x + dx, y: source.y + dy };
    if (!insideSearch(search, target) ||
        !canTraverse(search.world, source, target)) continue;
    const key = tileKey(target.x, target.y);
    if (reached.has(key)) continue;
    reached.add(key);
    queue.push(target);
  }
}

function canTraverse(
  world: RescueWorld,
  source: { readonly x: number; readonly y: number },
  target: { readonly x: number; readonly y: number },
): boolean {
  if (!world.isWalkable(target.x, target.y)) return false;
  const sourceGround = world.groundAt(source.x + 0.5, source.y + 0.5);
  const targetGround = world.groundAt(target.x + 0.5, target.y + 0.5);
  return Number.isFinite(targetGround) &&
    targetGround - sourceGround <= WALL_RISE + HEIGHT_EPSILON;
}

function insideSearch(
  search: ReachabilitySearch,
  tile: { readonly x: number; readonly y: number },
): boolean {
  return Math.abs(tile.x - Math.floor(search.origin.x)) <= search.radius &&
    Math.abs(tile.y - Math.floor(search.origin.y)) <= search.radius;
}

export function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}
