import type { EnemySlot } from "../../../state/state.js";
import {
  ATTACK_KIND,
  type MeleeSlotCandidate,
} from "../attackSpacing/attackSpacingTypes.js";

export function setMeleeReservation(
  sim: { tickCount: number },
  enemy: EnemySlot,
  input: {
    targetId: string;
    slot: MeleeSlotCandidate;
    kind?: "slot" | "bounded-fallback";
  },
): void {
  enemy.attackReservation = {
    kind: ATTACK_KIND.meleeSlot,
    targetId: input.targetId,
    x: input.slot.x,
    y: input.slot.y,
    z: input.slot.z,
    updatedAtTick: sim.tickCount,
  };
  enemy.meleeFormation = {
    targetId: input.targetId,
    kind: input.kind ?? "slot",
    x: input.slot.x,
    y: input.slot.y,
    z: input.slot.z,
    updatedAtTick: sim.tickCount,
  };
}

export function setMeleeHoldState(
  sim: { tickCount: number },
  enemy: EnemySlot,
  targetId: string,
): void {
  delete enemy.attackReservation;
  enemy.meleeFormation = {
    targetId,
    kind: "hold",
    x: enemy.entity.body.x,
    y: enemy.entity.body.y,
    z: enemy.entity.body.z,
    updatedAtTick: sim.tickCount,
    holdReason: "no-bounded-slot",
  };
}
