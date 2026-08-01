import type { EnemySlot, SimState } from "../../../state/state.js";
import { isCommittedAttackAnimation } from "../helpers/combatState.js";
import {
  ATTACK_KIND,
  type AttackMode,
  type MeleeSlotOccupant,
} from "./attackSpacingTypes.js";
import { isMeleeReservationValid } from "./retention/meleeReservationValidation.js";
import { rangedDirectionKey } from "./attackSpacingUtils.js";

export function pruneInvalidReservations(input: {
  readonly sim: SimState;
  readonly enemies: readonly EnemySlot[];
  readonly targets: ReadonlyMap<string, EnemySlot["entity"] | undefined>;
}): void {
  for (const enemy of input.enemies) {
    const reservation = enemy.attackReservation;
    if (!reservation) continue;
    const target = input.targets.get(enemy.entity.id);
    if (isReservationValidForTarget({
      sim: input.sim,
      reservation,
      enemy,
      target,
    })) continue;
    delete enemy.attackReservation;
    delete enemy.meleeFormation;
  }
}

function isReservationValidForTarget(input: {
  readonly sim: SimState;
  readonly reservation: { kind: string; targetId: string };
  readonly enemy: EnemySlot;
  readonly target: EnemySlot["entity"] | undefined;
}): boolean {
  if (!input.target || input.target.id !== input.reservation.targetId) return false;
  if (input.reservation.kind === ATTACK_KIND.meleeSlot) {
    return !input.enemy.def.attack.ranged && isMeleeReservationValid({
      sim: input.sim,
      enemy: input.enemy,
      target: input.target,
    });
  }
  return input.reservation.kind === ATTACK_KIND.rangedAim &&
    input.enemy.def.attack.ranged === true;
}

export function retainedMeleeSlotOccupants(input: {
  readonly sim: SimState;
  readonly enemies: readonly EnemySlot[];
  readonly targets: ReadonlyMap<string, EnemySlot["entity"] | undefined>;
  readonly targetId: string;
}): MeleeSlotOccupant[] {
  // Duplicate physical reservations remain distinct occupants. The selection
  // pass must see every committed body before assigning the next attacker.
  const retained = input.enemies
    .filter((enemy) => isRetainedReservation({ ...input, enemy, mode: "melee" }))
    .map(toMeleeSlotOccupant);
  return retained;
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
  readonly sim: SimState;
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
  readonly sim: SimState;
  readonly enemy: EnemySlot;
  readonly targets: ReadonlyMap<string, EnemySlot["entity"] | undefined>;
  readonly targetId: string;
  readonly mode: AttackMode;
}): boolean {
  if (!isReservationForTarget(input)) return false;
  if (!isCommittedAttackAnimation(input.enemy)) return false;
  return input.mode === "melee"
    ? isMeleeReservationRetained(input)
    : input.enemy.attackReservation?.kind === ATTACK_KIND.rangedAim;
}

function isMeleeReservationRetained(input: {
  readonly sim: SimState;
  readonly enemy: EnemySlot;
  readonly targets: ReadonlyMap<string, EnemySlot["entity"] | undefined>;
}): boolean {
  const target = input.targets.get(input.enemy.entity.id);
  return target !== undefined && isMeleeReservationValid({
    sim: input.sim,
    enemy: input.enemy,
    target,
  });
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
