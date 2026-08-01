import { type EnemyDecision } from "@dc2d/engine";
import type { SimState } from "../../../state/state.js";
import {
  type MeleeSlotOccupant,
  type AttackRequest,
} from "./attackSpacingTypes.js";
import {
  adjustMeleeDecision,
  chooseMeleeSlotSelection,
  selectDeterministicAttackers,
} from "./meleeSlotSelection.js";
import {
  setMeleeHoldState,
  setMeleeReservation,
} from "../helpers/meleeReservationState.js";

export function applyMeleeSlots(input: {
  readonly sim: SimState;
  readonly targetId: string;
  readonly requests: readonly AttackRequest[];
  readonly decisions: Map<string, EnemyDecision>;
  readonly initialOccupied?: readonly MeleeSlotOccupant[];
}): void {
  const occupiedSlots = [...input.initialOccupied ?? []];
  const ordered = selectDeterministicAttackers({
    targetId: input.targetId,
    requests: input.requests,
  });

  for (const request of ordered) {
    applyMeleeRequest({
      sim: input.sim,
      targetId: input.targetId,
      request,
      occupied: occupiedSlots,
      decisions: input.decisions,
      preserveImmediate: ordered.length === 1,
    });
  }
}

function applyMeleeRequest(input: {
  readonly sim: SimState;
  readonly targetId: string;
  readonly request: AttackRequest;
  readonly occupied: MeleeSlotOccupant[];
  readonly decisions: Map<string, EnemyDecision>;
  readonly preserveImmediate: boolean;
}): void {
  const slot = chooseSlot(input);
  if (!slot) {
    setMeleeHoldState(input.sim, input.request.enemy, input.targetId);
    suppressStrike({ request: input.request, decisions: input.decisions });
    return;
  }

  setMeleeReservation(input.sim, input.request.enemy, {
    targetId: input.targetId,
    slot: slot.slot,
    kind: slot.kind,
  });
  input.decisions.set(input.request.enemy.entity.id, adjustedDecision(input.request, slot.slot));
  input.occupied.push({ enemy: input.request.enemy, slot: slot.slot });
}

function chooseSlot(input: {
  readonly sim: SimState;
  readonly targetId: string;
  readonly request: AttackRequest;
  readonly occupied: MeleeSlotOccupant[];
  readonly preserveImmediate: boolean;
}): ReturnType<typeof chooseMeleeSlotSelection> {
  return chooseMeleeSlotSelection({
    sim: input.sim,
    enemy: input.request.enemy,
    target: input.request.target,
    targetId: input.targetId,
    attackRange: input.request.enemy.def.attack.range,
    occupied: input.occupied,
    preserveImmediate: input.preserveImmediate,
    decision: input.request.decision,
  });
}

function adjustedDecision(
  request: AttackRequest,
  slot: NonNullable<ReturnType<typeof chooseMeleeSlotSelection>>["slot"],
): EnemyDecision {
  return adjustMeleeDecision({
    enemy: request.enemy,
    target: request.target,
    attackRange: request.enemy.def.attack.range,
    slot,
    decision: request.decision,
  });
}

function suppressStrike(input: {
  readonly request: AttackRequest;
  readonly decisions: Map<string, EnemyDecision>;
}): void {
  const { strike: removedStrike, pursuit: removedPursuit, ...rest } = input.request.decision;
  void removedStrike;
  void removedPursuit;
  input.decisions.set(input.request.enemy.entity.id, {
    ...rest,
    move: { moveX: 0, moveY: 0, jump: false },
  });
}
