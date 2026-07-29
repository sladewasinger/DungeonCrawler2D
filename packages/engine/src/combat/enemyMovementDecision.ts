import type { Entity } from "../entities/entity.js";
import type { MoveInput } from "../entities/movement/index.js";
import type { EnemyBrain, EnemyDecision } from "./ai.js";
import {
  activeEnemyMemory,
  beginEnemySearch,
} from "./enemyMemory.js";

const AXIS: readonly [-1, 0, 1] = [-1, 0, 1];

interface Investigation {
  readonly brain: EnemyBrain;
  readonly enemy: Entity;
  readonly dt: number;
  readonly rng: () => number;
  readonly searchSeconds: number;
  readonly arrivalTolerance: number;
}

export interface RememberedMovementIntent {
  readonly state: "none" | "pursue" | "arrive" | "search";
  readonly target: ReturnType<typeof activeEnemyMemory>;
  readonly distance: number;
}

export function idleEnemyMove(): MoveInput {
  return { moveX: 0, moveY: 0, jump: false };
}

export function pursueEnemyPoint(
  enemy: Entity,
  point: { x: number; y: number; z: number },
): EnemyDecision {
  return {
    move: chaseMove(point.x - enemy.body.x, point.y - enemy.body.y),
    pursuit: point,
  };
}

export function investigateOrWander(input: Investigation): EnemyDecision {
  const intent = rememberedMovementIntent(input);
  if (intent.state === "none") return wander(input);
  if (intent.state === "pursue" && intent.target) {
    return pursueEnemyPoint(input.enemy, intent.target);
  }
  if (intent.state === "arrive") {
    beginEnemySearch(input.brain, input.searchSeconds);
  }
  return { move: idleEnemyMove(), searching: true };
}

export function rememberedMovementIntent(
  input: Pick<Investigation, "brain" | "enemy" | "arrivalTolerance">,
): RememberedMovementIntent {
  const target = activeEnemyMemory(input.brain);
  if (!target) return { state: "none", target: null, distance: Infinity };
  const distance = Math.hypot(
    target.x - input.enemy.body.x,
    target.y - input.enemy.body.y,
  );
  if (input.brain.memoryPhase === "searching") {
    return { state: "search", target, distance };
  }
  const state = distance <= input.arrivalTolerance ? "arrive" : "pursue";
  return { state, target, distance };
}

function wander(input: Investigation): EnemyDecision {
  const { brain, dt, rng } = input;
  brain.wanderLeft -= dt;
  if (brain.wanderLeft <= 0) {
    brain.wanderLeft = 1 + rng() * 2;
    brain.wanderDir = {
      moveX: pickAxis(rng),
      moveY: pickAxis(rng),
      jump: false,
    };
  }
  return { move: brain.wanderDir };
}

function pickAxis(rng: () => number): -1 | 0 | 1 {
  return AXIS[Math.floor(rng() * 3)] ?? 0;
}

function chaseMove(dx: number, dy: number): MoveInput {
  return {
    moveX: Math.abs(dx) > 0.3 ? (Math.sign(dx) as -1 | 0 | 1) : 0,
    moveY: Math.abs(dy) > 0.3 ? (Math.sign(dy) as -1 | 0 | 1) : 0,
    jump: false,
  };
}
