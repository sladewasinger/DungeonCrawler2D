import { applyMeleeSlots } from "./meleeSpacing.js";
import { applyRangedSpread } from "./rangedSpacing.js";
import {
  collectAttackRequests,
} from "./collectAttackRequests.js";
import {
  type AttackRequest,
  type AttackMode,
  type AttackSpacingInput,
} from "./attackSpacingTypes.js";
import type { EnemySlot, SimState } from "../../../state/state.js";
import type { EnemyDecision } from "@dc2d/engine";
import {
  pruneInvalidReservations,
  retainedMeleeSlotOccupants,
  retainedRangedSlotKeys,
} from "./retainedAttackOccupancy.js";

export function applyAttackSpacing(input: AttackSpacingInput): Map<string, EnemyDecision> {
  const decisions = new Map(input.decisions);
  pruneInvalidReservations({
    sim: input.sim,
    enemies: input.enemies,
    targets: input.targets,
  });

  applyGroupedSpacing({
    mode: "melee",
    sim: input.sim,
    enemies: input.enemies,
    targets: input.targets,
    decisions,
  });
  applyGroupedSpacing({
    mode: "ranged",
    sim: input.sim,
    enemies: input.enemies,
    targets: input.targets,
    decisions,
  });

  return decisions;
}

function applyGroupedSpacing(input: {
  readonly mode: AttackMode;
  readonly sim: SimState;
  readonly enemies: readonly EnemySlot[];
  readonly targets: ReadonlyMap<string, EnemySlot["entity"] | undefined>;
  readonly decisions: Map<string, EnemyDecision>;
}): void {
  const buckets = collectAttackRequests({
    enemies: input.enemies,
    targets: input.targets,
    decisions: input.decisions,
    mode: input.mode,
  });

  for (const [targetId, requests] of buckets) {
    applyTargetSpacing({ ...input, targetId, requests });
  }
}

function applyTargetSpacing(input: {
  readonly mode: AttackMode;
  readonly sim: SimState;
  readonly enemies: readonly EnemySlot[];
  readonly targets: ReadonlyMap<string, EnemySlot["entity"] | undefined>;
  readonly decisions: Map<string, EnemyDecision>;
  readonly targetId: string;
  readonly requests: readonly AttackRequest[];
}): void {
  if (input.mode === "melee") {
    applyMeleeSlots({
      sim: input.sim,
      targetId: input.targetId,
      requests: input.requests,
      decisions: input.decisions,
      initialOccupied: retainedMeleeSlotOccupants(input),
    });
    return;
  }
  applyRangedSpread({
    sim: input.sim,
    targetId: input.targetId,
    requests: input.requests,
    decisions: input.decisions,
    initialOccupied: retainedRangedSlotKeys(input),
  });
}
