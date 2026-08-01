import type { EnemySlot, SimState } from "../../../../state/state.js";
import { isCommittedAttackAnimation } from "../../helpers/combatState.js";
import { ENEMY_SIMULATION_TUNING } from "../../../configuration/enemySimulationTuning.js";
import {
  ATTACK_KIND,
  type SlotSelectionInput,
} from "../attackSpacingTypes.js";
import {
  canStrikeNow,
  isCurrentMeleeCandidate,
  isUsableCandidate,
} from "../meleeSlotSelectionHelpers.js";
import { isAtAttackSlot } from "../attackSpacingUtils.js";

export function isMeleeReservationValid(input: {
  readonly sim: SimState;
  readonly enemy: EnemySlot;
  readonly target: EnemySlot["entity"];
}): boolean {
  const reservation = input.enemy.attackReservation;
  if (!reservation || reservation.kind !== ATTACK_KIND.meleeSlot) return false;
  if (!reservationAgeIsValid(input.sim, reservation.updatedAtTick)) return false;
  const selection = {
    sim: input.sim,
    enemy: input.enemy,
    target: input.target,
    targetId: input.target.id,
    attackRange: input.enemy.def.attack.range,
    occupied: [],
  };
  if (isCurrentMeleeCandidate(selection, reservation)) {
    return isUsableCandidate(selection, {
      x: reservation.x,
      y: reservation.y,
      z: reservation.z,
      canShare: false,
    }, { policy: "exclusive" });
  }
  return committedBodyReservationIsValid({
    ...input,
    reservation,
    selection,
  });
}

export function hasReusableMeleeReservation(
  input: Pick<SlotSelectionInput, "sim" | "enemy" | "target">,
): boolean {
  const reservation = input.enemy.attackReservation;
  return reservation?.kind === ATTACK_KIND.meleeSlot &&
    reservation.targetId === input.target.id &&
    isMeleeReservationValid(input);
}

function committedBodyReservationIsValid(input: {
  readonly enemy: EnemySlot;
  readonly target: EnemySlot["entity"];
  readonly reservation: { x: number; y: number; z: number };
  readonly selection: {
    readonly sim: SimState;
    readonly enemy: EnemySlot;
    readonly target: EnemySlot["entity"];
    readonly targetId: string;
    readonly attackRange: number;
    readonly occupied: never[];
  };
}): boolean {
  if (!isCommittedAttackAnimation(input.enemy)) return false;
  if (!isAtAttackSlot(input.enemy.entity.body, input.reservation)) return false;
  if (Math.abs(input.enemy.entity.body.z - input.reservation.z) >
      ENEMY_SIMULATION_TUNING.perception.maximumMeleeHeightDifference) return false;
  if (!canStrikeNow({
    enemy: input.enemy,
    target: input.target,
    attackRange: input.selection.attackRange,
    decision: {},
  })) return false;
  return isUsableCandidate(input.selection, {
    x: input.reservation.x,
    y: input.reservation.y,
    z: input.reservation.z,
    canShare: false,
  }, { policy: "exclusive" });
}

function reservationAgeIsValid(sim: SimState, updatedAtTick: number): boolean {
  const age = sim.tickCount - updatedAtTick;
  const maximumAge = ENEMY_SIMULATION_TUNING.animationTicks.meleeAttack +
    ENEMY_SIMULATION_TUNING.animationTicks.meleeRecovery + 1;
  return age >= 0 && age <= maximumAge;
}
