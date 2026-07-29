import {
  NEUTRAL_INPUT,
  TICK_DT,
  faceEntity,
  stepBody,
  type MoveInput,
} from "@dc2d/engine";
import { isBodyInChasm } from "../../core/helpers.js";
import type { EnemySlot, SimState } from "../../state/state.js";
import { insideGracedClearance } from "../../spawnSafety/spawnSafety.js";
import { recordEnemyRouteMotion } from "./enemyMemoryNavigation.js";

export interface EnemyMoveInput {
  readonly sim: SimState;
  readonly enemy: EnemySlot;
  readonly move: MoveInput;
  readonly graced: ReadonlyArray<{ x: number; y: number }>;
}

interface EnemyBodyMotion {
  readonly x: number;
  readonly y: number;
  readonly blockedX: boolean;
  readonly blockedY: boolean;
}

export function moveEnemy(input: EnemyMoveInput): void {
  const { enemy, move } = input;
  const motion = stepEnemyBody(input);
  recordEnemyRouteMotion(enemy, move);
  faceEntity(enemy.entity, motion.x, motion.y);
  enemy.animation = walkingAnimation(motion);
}

export function continueAirborneEnemyPhysics(
  input: Omit<EnemyMoveInput, "move">,
): void {
  if (input.enemy.entity.body.grounded) return;
  stepEnemyBody({ ...input, move: NEUTRAL_INPUT });
}

function stepEnemyBody(input: EnemyMoveInput): EnemyBodyMotion {
  const { sim, enemy, move, graced } = input;
  const entity = enemy.entity;
  const before = { ...entity.body };
  const result = stepBody(
    sim.world,
    entity.body,
    move,
    TICK_DT,
    enemyMovementOptions(sim, enemy),
  );
  preserveGracedClearance(entity, before, graced);
  const motion = bodyMotion(entity, before, result);
  sim.replicationMotion.set(entity.id, { x: motion.x, y: motion.y });
  if (isBodyInChasm(sim.world, entity.body)) entity.hp = 0;
  return motion;
}

function enemyMovementOptions(sim: SimState, enemy: EnemySlot) {
  return {
    speed: enemy.entity.baseSpeed * sim.effects.speedMult(enemy.entity),
    blocked: (x: number, y: number) =>
      sim.world.isSanctuary(x, y) || outsideHome(enemy, x, y),
  };
}

function outsideHome(enemy: EnemySlot, x: number, y: number): boolean {
  const home = enemy.home;
  return home !== undefined &&
    (x < home.x0 || x > home.x1 || y < home.y0 || y > home.y1);
}

function preserveGracedClearance(
  entity: EnemySlot["entity"],
  before: EnemySlot["entity"]["body"],
  graced: ReadonlyArray<{ x: number; y: number }>,
): void {
  const entered = insideGracedClearance(
    graced,
    entity.body.x,
    entity.body.y,
  );
  if (!entered || insideGracedClearance(graced, before.x, before.y)) return;
  entity.body.x = before.x;
  entity.body.y = before.y;
}

function bodyMotion(
  entity: EnemySlot["entity"],
  before: EnemySlot["entity"]["body"],
  blocked: { readonly blockedX?: boolean; readonly blockedY?: boolean },
): EnemyBodyMotion {
  return {
    x: (entity.body.x - before.x) / TICK_DT,
    y: (entity.body.y - before.y) / TICK_DT,
    blockedX: blocked.blockedX ?? false,
    blockedY: blocked.blockedY ?? false,
  };
}

function walkingAnimation(motion: EnemyBodyMotion): EnemySlot["animation"] {
  const moving = motion.x !== 0 || motion.y !== 0;
  return { state: moving ? "walk" : "idle", ticksRemaining: 0 };
}
