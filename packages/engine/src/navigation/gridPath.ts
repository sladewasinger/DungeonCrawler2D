import { searchGridPath } from "./gridPathSearch.js";
import type { GridPathRequest, GridPathStep } from "./gridPathTypes.js";

export type {
  GridPathOptions,
  GridPathRequest,
  GridPathStep,
  GridPathTransition,
  GridPathTraversal,
} from "./gridPathTypes.js";

/**
 * Find a short cardinal route through a tile world. The bounded search is
 * intended for local AI recovery, not global routing.
 */
export function findGridPath(request: GridPathRequest): GridPathStep[] {
  return searchGridPath({ ...request, start: toTile(request.start), goal: toTile(request.goal) });
}

function toTile(point: { x: number; y: number }): { x: number; y: number } {
  return { x: Math.floor(point.x), y: Math.floor(point.y) };
}
