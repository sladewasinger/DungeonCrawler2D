import {
  applyKnockback,
  createBody,
  faceEntity,
  KNOCKBACK_FORCE,
  launchVelocity,
  makeEntity,
  newEntityId,
  stepBody,
  THROW_SPEED,
  TICK_DT,
  type EffectEvent,
} from "@dc2d/engine";
import { effectTargetFor, isBodyInChasm } from "../../helpers.js";
import { blocksAttackFrom } from "../../directionalBlock.js";
import type { EnemySlot, SimState } from "../../state.js";
import { insideGracedClearance } from "../../spawnSafety.js";

export interface EnemyMoveInput {
  sim: SimState;
  enemy: EnemySlot;
  move: { moveX: number; moveY: number; jump: boolean };
  graced: ReadonlyArray<{ x: number; y: number }>;
}

export interface EnemyStrikeInput {
  sim: SimState;
  enemy: EnemySlot;
  targetId: string;
  effectEvents: EffectEvent[];
  attackTicks: number;
}

export interface SpitLaunchInput {
  sim: SimState;
  entity: EnemySlot["entity"];
  tags: readonly string[];
  target: { x: number; y: number; z: number };
}

export function moveEnemy(input: EnemyMoveInput): void {
  const { sim, enemy, move, graced } = input;
  const entity = enemy.entity;
  faceEntity(entity, move.moveX, move.moveY);
  const before = { ...entity.body };
  stepBody(sim.world, entity.body, move, TICK_DT, enemyMovementOptions(sim, enemy));
  preserveGracedClearance(entity, before, graced);
  recordEnemyMotion(sim, entity, before);
  if (isBodyInChasm(sim.world, entity.body)) entity.hp = 0;
  enemy.animation = walkingAnimation(move);
}

function enemyMovementOptions(sim: SimState, enemy: EnemySlot) {
  return {
    speed: enemy.entity.baseSpeed * sim.effects.speedMult(enemy.entity),
    blocked: (x: number, y: number) => sim.world.isSanctuary(x, y) || outsideHome(enemy, x, y),
  };
}

function outsideHome(enemy: EnemySlot, x: number, y: number): boolean {
  const home = enemy.home;
  return home !== undefined && (x < home.x0 || x > home.x1 || y < home.y0 || y > home.y1);
}

function preserveGracedClearance(
  entity: EnemySlot["entity"],
  before: EnemySlot["entity"]["body"],
  graced: ReadonlyArray<{ x: number; y: number }>,
): void {
  const enteredClearance = insideGracedClearance(graced, entity.body.x, entity.body.y);
  if (enteredClearance && !insideGracedClearance(graced, before.x, before.y)) entity.body = before;
}

function recordEnemyMotion(
  sim: SimState,
  entity: EnemySlot["entity"],
  before: EnemySlot["entity"]["body"],
): void {
  sim.replicationMotion.set(entity.id, {
    x: (entity.body.x - before.x) / TICK_DT,
    y: (entity.body.y - before.y) / TICK_DT,
  });
}

function walkingAnimation(move: EnemyMoveInput["move"]): EnemySlot["animation"] {
  return { state: move.moveX !== 0 || move.moveY !== 0 ? "walk" : "idle", ticksRemaining: 0 };
}

export function resolveEnemyStrike(input: EnemyStrikeInput): void {
  const { sim, enemy, targetId, attackTicks } = input;
  const victimSlot = sim.players.get(targetId);
  const victim = victimSlot?.entity;
  if (!victim || victim.hp <= 0) return;
  faceEntity(enemy.entity, victim.body.x - enemy.entity.body.x, victim.body.y - enemy.entity.body.y);
  if (isOutOfStrikeRange(enemy, victim)) return;
  enemy.animation = { state: "attack", ticksRemaining: attackTicks };
  if (blocksAttackFrom(victimSlot, enemy.entity)) return;
  applyStrikeEffects(input, victim);
  applyKnockback(victim.body, {
    dirX: victim.body.x - enemy.entity.body.x,
    dirY: victim.body.y - enemy.entity.body.y,
    force: KNOCKBACK_FORCE * 0.6,
  });
}

function isOutOfStrikeRange(enemy: EnemySlot, victim: EnemySlot["entity"]): boolean {
  const { body } = enemy.entity;
  return Math.hypot(victim.body.x - body.x, victim.body.y - body.y) > enemy.def.attack.range + 0.3;
}

function applyStrikeEffects(input: EnemyStrikeInput, victim: EnemySlot["entity"]): void {
  const { sim, enemy, effectEvents } = input;
  const target = effectTargetFor(sim, victim);
  sim.effects.modifyHealth({ entity: victim, amount: -enemy.def.attack.damage, events: effectEvents, opts: { sourceTags: enemy.def.tags }, target });
  for (const apply of enemy.def.attack.applies ?? []) {
    if (sim.rng.next() < apply.chance) sim.effects.applyStatus({ entity: victim, statusId: apply.status, events: effectEvents, target });
  }
}

export function launchSpit(input: SpitLaunchInput): void {
  const { sim, entity, tags, target } = input;
  const projectile = makeEntity("projectile", createBody(entity.body.x, entity.body.y, entity.body.z + 0.5), {
    id: newEntityId("j"),
    ownerId: entity.id,
    tags: new Set(["spit", ...tags]),
    vel: launchVelocity({ x: entity.body.x, y: entity.body.y, z: entity.body.z + 0.5 }, target, THROW_SPEED),
  });
  sim.projectiles.set(projectile.id, projectile);
}
