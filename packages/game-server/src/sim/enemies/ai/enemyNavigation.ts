import { TICK_DT, type EnemyDecision, type MoveInput } from "@dc2d/engine";
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
  const speed = effectiveEnemySpeed(sim, enemy);
  const routeMove = routeWithMemory({
    sim,
    enemy,
    visibleTarget,
    decision,
  });
  if (!decision.pursuit) return routeWithLedgeJump(sim, enemy, routeMove);
  if (!visibleTarget) return routeMove;
  if (isStandoffPursuit(input) && input.decision.pursuitMode !== "melee-slot") {
    return routeWithLedgeJump(
      sim,
      enemy,
      withEnemyMemoryPath({
        sim,
        enemy,
        visibleTarget: undefined,
        pursuit: decision.pursuit,
        move: chaseToPoint({ enemy: enemy.entity, point: decision.pursuit, speed }),
      }),
    );
  }
  return routeWithLedgeJump(
    sim,
    enemy,
    chaseToPoint({ enemy: enemy.entity, point: decision.pursuit, speed }),
  );
}

function effectiveEnemySpeed(sim: SimState, enemy: EnemySlot): number {
  return enemy.entity.baseSpeed * sim.effects.speedMult(enemy.entity);
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

export function chaseToPoint(input: {
  readonly enemy: EnemySlot["entity"];
  readonly point: { readonly x: number; readonly y: number };
  readonly speed: number;
}): MoveInput {
  const dx = input.point.x - input.enemy.body.x;
  const dy = input.point.y - input.enemy.body.y;
  const distance = Math.hypot(dx, dy);
  const travel = input.speed * TICK_DT;
  if (distance <= ATTACK_SLOT_REACHED_EPSILON || travel <= 0) {
    return { moveX: 0, moveY: 0, jump: false };
  }
  const magnitude = Math.min(1, distance / travel);
  return {
    moveX: (dx / distance) * magnitude,
    moveY: (dy / distance) * magnitude,
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
