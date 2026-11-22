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

export function enemyPursuitMove(input: EnemyNavigationInput): MoveInput {
  const { sim, enemy, visibleTarget, decision } = input;
  const speed = effectiveEnemySpeed(sim, enemy);
  const routeMove = routeWithMemory({ sim, enemy, visibleTarget, decision });
  if (!decision.pursuit) return routeWithLedgeJump(sim, enemy, routeMove);
  if (!visibleTarget) return routeMove;
  if (isStandoffPursuit(input) && input.decision.pursuitMode !== "melee-slot") {
    const chase = chaseToPoint({ enemy: enemy.entity, point: decision.pursuit, speed });
    const memory = withEnemyMemoryPath({ sim, enemy, visibleTarget: undefined, pursuit: decision.pursuit, move: chase });
    return routeWithLedgeJump(sim, enemy, memory);
  }
  const point = packFlankingPoint(sim, enemy, decision.pursuit);
  return routeWithLedgeJump(sim, enemy, chaseToPoint({ enemy: enemy.entity, point, speed }));
}

function packFlankingPoint(
  sim: SimState,
  enemy: EnemySlot,
  pursuit: { readonly x: number; readonly y: number },
): { readonly x: number; readonly y: number } {
  if (!enemy.def.tags.includes("pack-hunter")) return pursuit;
  const dx = enemy.entity.body.x - pursuit.x;
  const dy = enemy.entity.body.y - pursuit.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2.1 || dist > 8.5) return pursuit;
  const packmates = [...sim.enemies.values()]
    .filter((e) => e.entity.hp > 0 && e.def.tags.includes("pack-hunter") &&
      Math.hypot(e.entity.body.x - pursuit.x, e.entity.body.y - pursuit.y) <= 12)
    .sort((a, b) => a.entity.id.localeCompare(b.entity.id));
  if (packmates.length <= 1) return pursuit;
  const idx = packmates.findIndex((e) => e.entity.id === enemy.entity.id);
  const angleOffset = (idx - (packmates.length - 1) * 0.5) * 0.7;
  const baseAngle = Math.atan2(dy, dx) + angleOffset;
  const flankRadius = Math.min(2.2, dist * 0.45);
  return {
    x: pursuit.x + Math.cos(baseAngle) * flankRadius,
    y: pursuit.y + Math.sin(baseAngle) * flankRadius,
  };
}

function effectiveEnemySpeed(sim: SimState, enemy: EnemySlot): number {
  let mult = sim.effects.speedMult(enemy.entity);
  if (enemy.def.tags.includes("apex-predator") && enemy.brain.targetId) {
    const target = sim.players.get(enemy.brain.targetId)?.entity;
    const dist = target ? Math.hypot(target.body.x - enemy.entity.body.x, target.body.y - enemy.entity.body.y) : 0;
    if (dist >= 2.2 && dist <= 6.5) mult *= 1.5;
  }
  return enemy.entity.baseSpeed * mult;
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
