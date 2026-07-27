import type { WorldView } from "../world/core/types.js";

export interface GridPoint {
  x: number;
  y: number;
}

/** A tile-centred waypoint returned by the shared navigation search. */
export interface GridPathStep extends GridPoint {
  /** Whether movement into this tile should begin a jump. */
  jump: boolean;
}

export interface GridPathTransition {
  jump: boolean;
  /** Optional additional cost for this edge (for example, a jump). */
  cost?: number;
}

export interface GridPathTraversal {
  from: GridPoint;
  to: GridPoint;
  fromGround: number;
  toGround: number;
  onStair: boolean;
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
  canEnter?: (position: GridPoint) => boolean;
  /** Override the default height/stair transition rules for a movement system. */
  canTraverse?: (traversal: GridPathTraversal) => GridPathTransition | null;
}

export interface GridPathRequest {
  world: WorldView;
  start: GridPoint;
  goal: GridPoint;
  options?: GridPathOptions;
}
