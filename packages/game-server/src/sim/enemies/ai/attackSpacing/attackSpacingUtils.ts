import {
  findGridPath,
  hashString,
  mixSeeds,
} from "@dc2d/engine";
import type { EnemySlot, SimState } from "../../../state/state.js";
import {
  ENEMY_SIMULATION_TUNING,
} from "../../configuration/enemySimulationTuning.js";
import { enemyOccupancyIsAllowed } from "../../roomIsolation/enemyRoomIsolation.js";
import {
  ATTACK_SLOT_REACHED_EPSILON,
  type CandidatePoint,
} from "./attackSpacingTypes.js";

export { meleeCandidates } from "./meleeSlotCandidates.js";

export function sortAttackers(input: {
  readonly targetId: string;
  readonly leftId: string;
  readonly rightId: string;
}): number {
  const leftSeed = attackSeed(input.leftId, input.targetId);
  const rightSeed = attackSeed(input.rightId, input.targetId);
  if (leftSeed !== rightSeed) return leftSeed - rightSeed;
  return input.leftId.localeCompare(input.rightId);
}

export function attackSeed(enemyId: string, targetId: string): number {
  return mixSeeds(hashString(enemyId), hashString(targetId));
}

export function isAtAttackSlot(body: CandidatePoint, point: CandidatePoint): boolean {
  return Math.hypot(body.x - point.x, body.y - point.y) <= ATTACK_SLOT_REACHED_EPSILON;
}

export function slotKey(point: CandidatePoint): string {
  return `${point.x.toFixed(4)},${point.y.toFixed(4)}`;
}

export function slotReachable(
  sim: SimState,
  enemy: EnemySlot,
  candidate: CandidatePoint,
): boolean {
  if (isAtAttackSlot(enemy.entity.body, candidate)) return true;
  if (sameTile(enemy.entity.body, candidate)) {
    return slotWalkable(sim, enemy, candidate);
  }
  const path = findGridPath({
    world: sim.world,
    start: enemy.entity.body,
    goal: candidate,
    options: {
      maxExpansions: ENEMY_SIMULATION_TUNING.perception.memoryPathMaxExpansions,
      margin: ENEMY_SIMULATION_TUNING.perception.memoryPathMarginTiles,
      maxJumpRise: ENEMY_SIMULATION_TUNING.perception.jumpRiseTiles,
      jumpThreshold: ENEMY_SIMULATION_TUNING.perception.jumpRiseTiles - ENEMY_SIMULATION_TUNING.perception.jumpHeightTolerance,
      canEnter: (position: { x: number; y: number }) => slotWalkable(sim, enemy, position),
    },
  });
  return path.length > 0;
}

function sameTile(left: CandidatePoint, right: CandidatePoint): boolean {
  return Math.floor(left.x) === Math.floor(right.x) &&
    Math.floor(left.y) === Math.floor(right.y);
}

export function slotWalkable(
  sim: SimState,
  enemy: EnemySlot,
  candidate: CandidatePoint,
): boolean {
  if (!sim.world.isWalkable(Math.floor(candidate.x), Math.floor(candidate.y))) return false;
  if (!enemyOccupancyIsAllowed(sim, { x: candidate.x, y: candidate.y })) return false;
  return inHomeRange(enemy, Math.floor(candidate.x), Math.floor(candidate.y));
}

function inHomeRange(enemy: EnemySlot, tileX: number, tileY: number): boolean {
  const home = enemy.home;
  return home === undefined || (tileX >= home.x0 && tileX <= home.x1 && tileY >= home.y0 && tileY <= home.y1);
}

export function rangedDirectionKey(direction: { x: number; y: number }): string {
  return `${direction.x},${direction.y}`;
}
