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

export interface EnemyObservedTarget {
  readonly targetId: string;
  readonly x: number;
  readonly y: number;
  readonly movementX: number;
  readonly movementY: number;
}

/** Sandbox-only reconstruction request for a defeated regenerating target. */
export interface PendingEnemyRespawn {
  readonly defId: string;
  readonly x: number;
  readonly y: number;
  readonly dueTick: number;
}

export interface EnemySearchState {
  readonly anchor: EnemySearchPoint;
  readonly visitedWaypointKeys: readonly string[];
  readonly candidateCursor: number;
  readonly pauseTicksRemaining: number;
  readonly forward?: { readonly x: number; readonly y: number };
  readonly waypoint?: EnemySearchPoint;
}

export interface DirectionalFlameState {
  readonly kind: "directional-flame";
  /** Ordered, unique authoritative flame cells from the source toward the target. */
  readonly cells: readonly DirectionalFlameCell[];
  readonly hitTargetIds: Set<string>;
  nextSegment: number;
  ticksUntilSegment: number;
}

export interface DirectionalFlameCell {
  readonly x: number;
  readonly y: number;
}

export interface EnemyAttackAnimationTarget {
  readonly targetId: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Stable additive offset for this ranged enemy's firing spread. */
  readonly spreadX?: number;
  readonly spreadY?: number;
}

export interface EnemyMeleeAttackReservation {
  readonly kind: "melee-slot";
  readonly targetId: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly updatedAtTick: number;
}

export interface EnemyRangedAttackReservation {
  readonly kind: "ranged-aim";
  readonly targetId: string;
  readonly directionX: number;
  readonly directionY: number;
  /** Absolute standoff coordinates for the enemy's chosen ranged movement point. */
  readonly x: number;
  readonly y: number;
  readonly updatedAtTick: number;
}

export interface EnemyMeleeFormationState {
  readonly targetId: string;
  readonly kind: "slot" | "bounded-fallback" | "hold";
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly updatedAtTick: number;
  readonly holdReason?: "no-bounded-slot";
}

export type EnemyAttackReservation =
  | EnemyMeleeAttackReservation
  | EnemyRangedAttackReservation;

export interface EnemySlot {
  entity: Entity;
  brain: EnemyBrain;
  def: EnemyDef;
  /** Most recent authoritative damage source, retained for delayed kill credit. */
  lastDamageSourceId?: string;
  /** Fixed-tick runtime for a currently active elemental attack. */
  elementalAttack?: DirectionalFlameState;
  /** Cached only while following a last-seen target; optional for legacy fixtures. */
  rememberedRoute?: EnemyRememberedRoute | null;
  /** Bounded investigation state; the brain owns the non-resetting deadline. */
  searchState?: EnemySearchState | null;
  /** Latest visible target position and its retained travel direction. */
  lastObservedTarget?: EnemyObservedTarget;
  home?: {
    readonly x0: number;
    readonly y0: number;
    readonly x1: number;
    readonly y1: number;
  };
  /** Ordinary mini-boss encounter identity; absent for normal enemies. */
  arenaKey?: string;
  /** Explicit encounter leader; its death permanently clears the arena. */
  arenaLeader?: true;
  animation: {
    state: EnemyAnimationState;
    ticksRemaining: number;
    target?: EnemyAttackAnimationTarget;
  };
  /** Server-only short-range attack routing and firing reservations. */
  attackReservation?: EnemyAttackReservation;
  /** Explicit melee slot, bounded fallback, or intentional hold state. */
  meleeFormation?: EnemyMeleeFormationState;
}
