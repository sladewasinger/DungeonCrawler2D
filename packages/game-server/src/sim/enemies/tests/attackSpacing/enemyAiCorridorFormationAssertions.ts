import { combatHurtbox, type Entity } from "@dc2d/engine";
import { expect } from "vitest";
import type { EnemySlot, SimState } from "../../../state/state.js";

export interface CorridorProgress {
  readonly goal: string;
  readonly distance: number;
  readonly bodyX: number;
  readonly bodyY: number;
  readonly moved: boolean;
  readonly progressed: boolean;
  readonly holdReason: boolean;
}

export function corridorSpawnPoints(
  sim: SimState,
  tileX: number,
  tileY: number,
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (let offset = -2; offset <= 2; offset += 1) {
    const y = tileY + offset + 0.5;
    if (!sim.world.isWalkable(tileX, tileY + offset)) continue;
    if (points.some((point) => Math.abs(point.y - y) <= 1.1)) continue;
    points.push({ x: tileX + 0.5, y });
    if (points.length === 3) return points;
  }
  return points;
}

export function assertCorridorState(input: {
  readonly sim: SimState;
  readonly player: Entity;
  readonly progress: Map<string, CorridorProgress>;
  readonly enforceOverlapAllowance: boolean;
}): void {
  const skeletons = [...input.sim.enemies.values()]
    .filter((enemy) => enemy.def.id === "skeleton");
  expect(skeletons).toHaveLength(3);
  if (input.enforceOverlapAllowance) {
    expect(hurtboxOverlapCount(skeletons)).toBeLessThanOrEqual(1);
  }
  for (const enemy of skeletons) {
    const goal = corridorGoal(enemy, input.player);
    assertNonCenterGoal(enemy, goal, input.player);
    assertGoalProgress(enemy, goal, input.progress);
  }
}

function corridorGoal(enemy: EnemySlot, player: Entity): { x: number; y: number } {
  const formation = enemy.meleeFormation;
  expect(formation?.targetId).toBe(player.id);
  expect(formation).toBeDefined();
  if (!formation) throw new Error("missing corridor formation metadata");
  if (formation.kind === "hold") {
    expect(enemy.attackReservation).toBeUndefined();
    expect(formation.holdReason).toBe("no-bounded-slot");
  } else {
    expect(enemy.attackReservation?.kind).toBe("melee-slot");
    expect(formation.holdReason).toBeUndefined();
    expect(enemy.attackReservation?.x).toBe(formation.x);
    expect(enemy.attackReservation?.y).toBe(formation.y);
  }
  return formation;
}

function assertNonCenterGoal(
  enemy: EnemySlot,
  goal: { x: number; y: number },
  player: Entity,
): void {
  if (enemy.meleeFormation?.kind === "hold") return;
  expect(Math.hypot(goal.x - player.body.x, goal.y - player.body.y)).toBeGreaterThan(0.35);
}

function assertGoalProgress(
  enemy: EnemySlot,
  goal: { x: number; y: number },
  progress: Map<string, CorridorProgress>,
): void {
  const current = currentProgress(enemy, goal, progress.get(enemy.entity.id));
  const previous = progress.get(enemy.entity.id);
  assertGoalDoesNotRegress(current, previous);
  progress.set(enemy.entity.id, current);
}

function currentProgress(
  enemy: EnemySlot,
  goal: { x: number; y: number },
  previous: CorridorProgress | undefined,
): CorridorProgress {
  const goalKey = `${goal.x},${goal.y}`;
  const distance = Math.hypot(enemy.entity.body.x - goal.x, enemy.entity.body.y - goal.y);
  return {
    goal: goalKey,
    distance,
    bodyX: enemy.entity.body.x,
    bodyY: enemy.entity.body.y,
    moved: wasMoved(enemy, previous),
    progressed: wasProgressed(goalKey, distance, previous),
    holdReason: hasHoldReason(enemy, previous),
  };
}

function wasMoved(enemy: EnemySlot, previous: CorridorProgress | undefined): boolean {
  if (previous?.moved === true) return true;
  if (!previous) return false;
  return Math.hypot(
    enemy.entity.body.x - previous.bodyX,
    enemy.entity.body.y - previous.bodyY,
  ) > 0.001;
}

function wasProgressed(
  goal: string,
  distance: number,
  previous: CorridorProgress | undefined,
): boolean {
  if (previous?.progressed === true) return true;
  return previous?.goal === goal && distance < previous.distance - 0.001;
}

function hasHoldReason(enemy: EnemySlot, previous: CorridorProgress | undefined): boolean {
  return previous?.holdReason === true || enemy.meleeFormation?.holdReason === "no-bounded-slot";
}

function assertGoalDoesNotRegress(
  current: CorridorProgress,
  previous: CorridorProgress | undefined,
): void {
  if (previous?.goal !== current.goal) return;
  expect(current.distance).toBeLessThanOrEqual(previous.distance + 0.35);
}

function hurtboxOverlapCount(enemies: readonly EnemySlot[]): number {
  let overlaps = 0;
  for (let left = 0; left < enemies.length; left += 1) {
    for (let right = left + 1; right < enemies.length; right += 1) {
      if (enemiesOverlap(enemies[left]!, enemies[right]!)) overlaps += 1;
    }
  }
  return overlaps;
}

function enemiesOverlap(left: EnemySlot, right: EnemySlot): boolean {
  const leftHurtbox = combatHurtbox(left.entity);
  const rightHurtbox = combatHurtbox(right.entity);
  return Math.abs(left.entity.body.x - right.entity.body.x) <=
      leftHurtbox.halfWidth + rightHurtbox.halfWidth &&
    Math.abs(left.entity.body.y - right.entity.body.y) <=
      leftHurtbox.halfDepth + rightHurtbox.halfDepth;
}
