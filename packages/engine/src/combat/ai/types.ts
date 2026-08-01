import type { EnemyDef } from "../../effects/types.js";
import type { Entity } from "../../entities/entity.js";
import type { MoveInput } from "../../entities/movement/index.js";

export interface EnemyBrain {
  targetId: string | null;
  wanderDir: MoveInput;
  wanderLeft: number;
  attackCooldown: number;
  rememberedTarget: RememberedEnemyTarget | null;
  memorySecondsRemaining: number;
  memoryPhase?: "pursuing" | "searching";
  memorySearchSecondsRemaining?: number;
}

export interface RememberedEnemyTarget {
  readonly targetId: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface EnemyDecision {
  move: MoveInput;
  searching?: boolean;
  strike?: { targetId: string; immediate?: true };
  shoot?: {
    targetId: string;
    x: number;
    y: number;
    z: number;
    spreadX?: number;
    spreadY?: number;
  };
  pursuit?: { x: number; y: number; z: number };
  pursuitMode?: "melee-slot";
}

export interface AggroSearch {
  enemy: Entity;
  def: EnemyDef;
  players: readonly Entity[];
  inSanctuary: (entity: Entity) => boolean;
}
