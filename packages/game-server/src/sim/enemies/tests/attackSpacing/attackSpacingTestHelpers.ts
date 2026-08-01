import { combatHurtbox } from "@dc2d/engine";
import type { EnemySlot, SimState } from "../../../state/state.js";

export type MeleeAttackReservation = {
  readonly kind: "melee-slot";
  readonly targetId: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

type EnemyAttackReservationLike = {
  readonly kind: string;
  readonly x: number;
  readonly y: number;
  readonly z?: number;
};

type StartPoint = { x: number; y: number };

export function hasMovedFrom(
  startPoints: ReadonlyMap<string, StartPoint>,
): (enemy: { readonly entity: { readonly id: string; readonly body: StartPoint } }) => boolean {
  return (enemy) => {
    const before = startPoints.get(enemy.entity.id);
    if (!before) return false;
    return enemy.entity.body.x !== before.x || enemy.entity.body.y !== before.y;
  };
}

export function asMeleeReservation(
  reservation: EnemyAttackReservationLike | undefined,
): MeleeAttackReservation {
  if (!isMeleeReservation(reservation)) {
    throw new Error("expected melee reservation");
  }
  return reservation;
}

function isMeleeReservation(
  reservation: EnemyAttackReservationLike | undefined,
): reservation is MeleeAttackReservation {
  return reservation?.kind === "melee-slot" && reservation.z !== undefined;
}

export function spawnStartPoints(sim: SimState): Map<string, { x: number; y: number }> {
  return new Map(
    [...sim.enemies.values()].map((enemy) => [enemy.entity.id, {
      x: enemy.entity.body.x,
      y: enemy.entity.body.y,
    }]),
  );
}

export function requireEnemy(sim: SimState, id: string): EnemySlot {
  const enemy = sim.enemies.get(id);
  if (!enemy) throw new Error(`missing enemy fixture: ${id}`);
  return enemy;
}

export function reservationsRemainStable(
  sim: SimState,
  entities: readonly { id: string }[],
  reservations: Map<string, string>,
): boolean {
  for (const entity of entities) {
    const reservation = asMeleeReservation(requireEnemy(sim, entity.id).attackReservation);
    const slot = `${reservation.x},${reservation.y}`;
    const previous = reservations.get(entity.id);
    if (previous && previous !== slot) return false;
    reservations.set(entity.id, slot);
  }
  return true;
}

export function enemiesAreSeparated(enemies: readonly EnemySlot[]): boolean {
  for (let left = 0; left < enemies.length; left += 1) {
    for (let right = left + 1; right < enemies.length; right += 1) {
      if (enemiesOverlap(enemies[left]!, enemies[right]!)) return false;
    }
  }
  return true;
}

function enemiesOverlap(left: EnemySlot, right: EnemySlot): boolean {
  const leftHurtbox = combatHurtbox(left.entity);
  const rightHurtbox = combatHurtbox(right.entity);
  return Math.abs(left.entity.body.x - right.entity.body.x) <=
      leftHurtbox.halfWidth + rightHurtbox.halfWidth &&
    Math.abs(left.entity.body.y - right.entity.body.y) <=
      leftHurtbox.halfDepth + rightHurtbox.halfDepth;
}
