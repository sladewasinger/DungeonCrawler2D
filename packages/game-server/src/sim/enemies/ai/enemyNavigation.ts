import type { EnemyDecision, MoveInput } from "@dc2d/engine";
import type { EnemySlot, SimState } from "../../state/state.js";
import { withEnemyMemoryPath } from "./enemyMemoryNavigation.js";
import { withLedgeTransitionJump } from "./enemyPursuit.js";
import { ATTACK_SLOT_REACHED_EPSILON } from "./attackSpacing/attackSpacingTypes.js";

interface EnemyNavigationInput {
  readonly sim: SimState;
  readonly enemy: EnemySlot;
  readonly visibleTarget: EnemySlot["entity"] | undefined;
  readonly decision: EnemyDecision;
}

export function enemyPursuitMove(
  input: EnemyNavigationInput,
): MoveInput {
  const { sim, enemy, visibleTarget, decision } = input;
  const routeMove = routeWithMemory({
    sim,
    enemy,
    visibleTarget,
    decision,
  });
  if (!decision.pursuit) return routeWithLedgeJump(sim, enemy, routeMove);
  if (!visibleTarget) return routeMove;
  if (isStandoffPursuit(input)) {
    return routeWithLedgeJump(
      sim,
      enemy,
      withEnemyMemoryPath({
        sim,
        enemy,
        visibleTarget: undefined,
        pursuit: decision.pursuit,
        move: chaseToPoint(enemy.entity, decision.pursuit),
      }),
    );
  }
  return routeWithLedgeJump(sim, enemy, chaseToPoint(enemy.entity, decision.pursuit));
}

function routeWithMemory(
  input: {
    sim: SimState;
    enemy: EnemySlot;
    visibleTarget: EnemySlot["entity"] | undefined;
    decision: EnemyDecision;
  },
): MoveInput {
  return withEnemyMemoryPath({
    sim: input.sim,
    enemy: input.enemy,
    visibleTarget: input.visibleTarget,
    pursuit: input.decision.pursuit,
    move: input.decision.move,
  });
}

function routeWithLedgeJump(
  sim: SimState,
  enemy: EnemySlot,
  move: MoveInput,
): MoveInput {
  return withLedgeTransitionJump({
    world: sim.world,
    enemy: enemy.entity,
    move,
  });
}

function chaseToPoint(
  enemy: EnemySlot["entity"],
  point: { x: number; y: number },
): MoveInput {
  return {
    moveX: Math.abs(point.x - enemy.body.x) > ATTACK_SLOT_REACHED_EPSILON
      ? (Math.sign(point.x - enemy.body.x) as -1 | 0 | 1)
      : 0,
    moveY: Math.abs(point.y - enemy.body.y) > ATTACK_SLOT_REACHED_EPSILON
      ? (Math.sign(point.y - enemy.body.y) as -1 | 0 | 1)
      : 0,
    jump: false,
  };
}

function isStandoffPursuit(input: EnemyNavigationInput): boolean {
  if (!input.visibleTarget || !input.decision.pursuit) return false;
  if (input.visibleTarget.body.x === input.decision.pursuit.x &&
    input.visibleTarget.body.y === input.decision.pursuit.y) return false;
  return input.decision.move.moveX === 0 &&
    input.decision.move.moveY === 0 &&
    input.decision.move.jump === false;
}
