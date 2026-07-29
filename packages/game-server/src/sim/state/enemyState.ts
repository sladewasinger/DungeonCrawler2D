import type {
  EnemyAnimationState,
  EnemyBrain,
  EnemyDef,
  Entity,
  GridPathStep,
} from "@dc2d/engine";

export interface EnemyRememberedRoute {
  readonly targetId: string;
  readonly goalTileX: number;
  readonly goalTileY: number;
  readonly steps: GridPathStep[];
  progress?: EnemyRouteProgress;
}

export interface EnemyRouteProgress {
  readonly stepX: number;
  readonly stepY: number;
  readonly bestDistance: number;
  readonly stalledTicks: number;
}

export interface EnemySearchPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface EnemySearchState {
  readonly anchor: EnemySearchPoint;
  readonly visitedWaypointKeys: readonly string[];
  readonly candidateCursor: number;
  readonly pauseTicksRemaining: number;
  readonly waypoint?: EnemySearchPoint;
}

export interface EnemySlot {
  entity: Entity;
  brain: EnemyBrain;
  def: EnemyDef;
  /** Cached only while following a last-seen target; optional for legacy fixtures. */
  rememberedRoute?: EnemyRememberedRoute | null;
  /** Bounded investigation state; the brain owns the non-resetting deadline. */
  searchState?: EnemySearchState | null;
  home?: {
    readonly x0: number;
    readonly y0: number;
    readonly x1: number;
    readonly y1: number;
  };
  /** Ordinary mini-boss encounter identity; absent for normal enemies. */
  arenaKey?: string;
  animation: {
    state: EnemyAnimationState;
    ticksRemaining: number;
    target?: { targetId: string; x: number; y: number; z: number };
  };
}
