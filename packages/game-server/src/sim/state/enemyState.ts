import type {
  EnemyAnimationState,
  EnemyBrain,
  EnemyDef,
  Entity,
} from "@dc2d/engine";

export interface EnemySlot {
  entity: Entity;
  brain: EnemyBrain;
  def: EnemyDef;
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
