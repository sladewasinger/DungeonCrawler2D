import { STEP_UP } from "../core/constants.js";
import type { WorldView } from "../world/core/types.js";
import { stairRimBlocks } from "./stairTraversal.js";
import type { GridPathOptions, GridPathTransition, GridPathTraversal } from "./gridPathTypes.js";

interface SearchLimits { maxJumpRise: number; jumpThreshold: number; }
interface GridTile { x: number; y: number; }

export function transitionAt(
  request: { world: WorldView; options: GridPathOptions; limits: SearchLimits; from: GridTile; to: GridTile },
): GridPathTransition | null {
  const { world, options, limits, from, to } = request;
  const traversal = createTraversal(world, from, to);
  if (blocksStairRim(world, traversal)) return null;
  return options.canTraverse?.(traversal) ?? defaultTransition(traversal, limits);
}

function createTraversal(world: WorldView, from: GridTile, to: GridTile): GridPathTraversal {
  return {
    from, to,
    fromGround: groundAt(world, from), toGround: groundAt(world, to),
    onStair: isOnStair(world, from) || isOnStair(world, to),
  };
}

function groundAt(world: WorldView, tile: GridTile): number {
  return world.groundAt(tile.x + 0.5, tile.y + 0.5);
}

function isOnStair(world: WorldView, tile: GridTile): boolean {
  return world.stairHeightAt(tile.x + 0.5, tile.y + 0.5) !== null;
}

function blocksStairRim(world: WorldView, traversal: GridPathTraversal): boolean {
  return traversal.onStair && stairRimBlocks({ world, from: traversal.from, to: traversal.to });
}

function defaultTransition(traversal: GridPathTraversal, limits: SearchLimits): GridPathTransition | null {
  const rise = traversal.toGround - traversal.fromGround;
  if (!traversal.onStair && rise > limits.maxJumpRise) return null;
  const jump = !traversal.onStair && (rise >= limits.jumpThreshold || rise > STEP_UP);
  return { jump, cost: jump ? 0.25 : 0 };
}
