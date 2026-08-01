import type { EnemySlot } from "../../../state/state.js";
import { isCommittedAttackAnimation } from "../helpers/combatState.js";
import {
  ATTACK_KIND,
  type AttackMode,
  type MeleeSlotOccupant,
} from "./attackSpacingTypes.js";
import { rangedDirectionKey } from "./attackSpacingUtils.js";

export function pruneInvalidReservations(input: {
  readonly enemies: readonly EnemySlot[];
  readonly targets: ReadonlyMap<string, EnemySlot["entity"] | undefined>;
}): void {
  for (const enemy of input.enemies) {
    const reservation = enemy.attackReservation;
    if (!reservation) continue;
    const target = input.targets.get(enemy.entity.id);
    if (isReservationValidForTarget(reservation, enemy, target)) continue;
    delete enemy.attackReservation;
    delete enemy.meleeFormation;
  }
}

function isReservationValidForTarget(
  reservation: { kind: string; targetId: string },
  enemy: EnemySlot,
  target: EnemySlot["entity"] | undefined,
): boolean {
  if (!target || target.id !== reservation.targetId) return false;
  if (reservation.kind === ATTACK_KIND.meleeSlot) return !enemy.def.attack.ranged;
  return reservation.kind === ATTACK_KIND.rangedAim && enemy.def.attack.ranged === true;
}

export function retainedMeleeSlotOccupants(input: {
  readonly enemies: readonly EnemySlot[];
  readonly targets: ReadonlyMap<string, EnemySlot["entity"] | undefined>;
  readonly targetId: string;
}): MeleeSlotOccupant[] {
  return input.enemies
    .filter((enemy) => isReservationForTarget({ ...input, enemy, mode: "melee" }))
    .map(toMeleeSlotOccupant);
}

function toMeleeSlotOccupant(enemy: EnemySlot): MeleeSlotOccupant {
  const reservation = enemy.attackReservation;
  if (!reservation || reservation.kind !== ATTACK_KIND.meleeSlot) {
    throw new Error("Expected a retained melee reservation");
  }
  return {
    enemy,
    slot: {
      x: reservation.x,
      y: reservation.y,
      z: reservation.z,
      canShare: false,
    },
  };
}

export function retainedRangedSlotKeys(input: {
  readonly enemies: readonly EnemySlot[];
  readonly targets: ReadonlyMap<string, EnemySlot["entity"] | undefined>;
  readonly targetId: string;
}): Set<string> {
  return new Set(input.enemies
    .filter((enemy) => isRetainedReservation({ ...input, enemy, mode: "ranged" }))
    .map((enemy) => rangedReservationKey(enemy)));
}

function rangedReservationKey(enemy: EnemySlot): string {
  const reservation = enemy.attackReservation;
  if (!reservation || reservation.kind !== ATTACK_KIND.rangedAim) {
    throw new Error("Expected a retained ranged reservation");
  }
  return rangedDirectionKey({ x: reservation.directionX, y: reservation.directionY });
}

function isRetainedReservation(input: {
  readonly enemy: EnemySlot;
  readonly targets: ReadonlyMap<string, EnemySlot["entity"] | undefined>;
  readonly targetId: string;
  readonly mode: AttackMode;
}): boolean {
  if (!isReservationForTarget(input)) return false;
  if (!isCommittedAttackAnimation(input.enemy)) return false;
  return input.mode === "melee"
    ? input.enemy.attackReservation?.kind === ATTACK_KIND.meleeSlot
    : input.enemy.attackReservation?.kind === ATTACK_KIND.rangedAim;
}

function isReservationForTarget(input: {
  readonly enemy: EnemySlot;
  readonly targets: ReadonlyMap<string, EnemySlot["entity"] | undefined>;
  readonly targetId: string;
  readonly mode: AttackMode;
}): boolean {
  const reservation = input.enemy.attackReservation;
  if (!reservation || reservation.targetId !== input.targetId) return false;
  if (input.targets.get(input.enemy.entity.id)?.id !== input.targetId) return false;
  return input.mode === "melee"
    ? reservation.kind === ATTACK_KIND.meleeSlot
    : reservation.kind === ATTACK_KIND.rangedAim;
}
