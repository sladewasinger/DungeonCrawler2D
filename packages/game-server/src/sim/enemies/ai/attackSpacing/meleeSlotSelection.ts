import { NEUTRAL_INPUT, type EnemyDecision, type Entity } from "@dc2d/engine";
import type { EnemySlot } from "../../../state/state.js";
import {
  type AttackRequest,
  type MeleeSlotCandidate,
  type SlotSelectionInput,
} from "./attackSpacingTypes.js";
import {
  attackSeed,
  isAtAttackSlot,
  meleeCandidates,
  sortAttackers,
} from "./attackSpacingUtils.js";
import {
  canStrikeNow,
  createRange,
  reuseMeleeSlot,
  isUsableCandidate,
} from "./meleeSlotSelectionHelpers.js";
import { fallbackMeleeApproachPoint } from "./meleeFallbackSelection.js";
import { hasReusableMeleeReservation } from "./retention/meleeReservationValidation.js";
export { fallbackMeleeApproachPoint } from "./meleeFallbackSelection.js";

const BOUNDED_FALLBACK_KIND = "bounded-fallback" as const;

export interface MeleeSlotSelection {
  readonly slot: MeleeSlotCandidate;
  readonly kind: "slot" | typeof BOUNDED_FALLBACK_KIND;
  readonly immediateStrike?: true;
  readonly preserveFormationReservation?: true;
}

export interface MeleeDecisionInput {
  readonly enemy: EnemySlot;
  readonly target: Entity;
  readonly attackRange: number;
  readonly decision: EnemyDecision;
  readonly slot: MeleeSlotCandidate;
  readonly immediateStrike?: true;
}
export function chooseMeleeSlot(input: SlotSelectionInput): MeleeSlotCandidate | undefined {
  return chooseMeleeSlotSelection(input)?.slot;
}

export function chooseMeleeSlotSelection(
  input: SlotSelectionInput,
): MeleeSlotSelection | undefined {
  // A currently accepted strike outranks stale reservation reuse.
  const immediate = immediateMeleeSlot(input);
  if (immediate) {
    return {
      slot: immediate,
      kind: "slot",
      immediateStrike: true,
      ...(hasReusableMeleeReservation(input) ? {
        preserveFormationReservation: true,
      } : {}),
    };
  }
  const reservation = reuseMeleeSlot(input);
  if (reservation) return { slot: reservation, kind: "slot" };
  const exclusive = nonSharedSlot(input);
  if (exclusive) return { slot: exclusive, kind: "slot" };
  const fallback = fallbackMeleeApproachPoint(input);
  return fallback ? { slot: fallback, kind: BOUNDED_FALLBACK_KIND } : undefined;
}

function immediateMeleeSlot(
  input: SlotSelectionInput,
): MeleeSlotCandidate | undefined {
  if (!input.preserveImmediate || !input.decision?.strike) return undefined;
  if (!canStrikeNow({
    enemy: input.enemy,
    target: input.target,
    attackRange: input.attackRange,
    decision: input.decision,
  })) return undefined;
  const { body } = input.enemy.entity;
  const isNonCenter = Math.hypot(
    body.x - input.target.body.x,
    body.y - input.target.body.y,
  ) > 0.35;
  if (!isNonCenter) return undefined;
  const candidate = {
    x: body.x,
    y: body.y,
    z: body.z,
    canShare: false,
  } satisfies MeleeSlotCandidate;
  return isUsableCandidate(input, candidate, { policy: "exclusive" })
    ? candidate
    : undefined;
}
export function adjustMeleeDecision(
  input: MeleeDecisionInput,
): EnemyDecision {
  const { strike: removedStrike, shoot: removedShoot, pursuit: removedPursuit, ...rest } = input.decision;
  void removedStrike;
  void removedShoot;
  void removedPursuit;
  const positioned = isAtAttackSlot(input.enemy.entity.body, input.slot);
  if (positioned && input.enemy.brain.attackCooldown <= 0 && canStrikeNow(input)) {
    return {
      ...rest,
      move: NEUTRAL_INPUT,
      strike: {
        targetId: input.target.id,
        ...(input.immediateStrike ? { immediate: true } : {}),
      },
    };
  }
  const held = { ...rest, move: NEUTRAL_INPUT };
  if (positioned) return held;
  return {
    ...held,
    pursuitMode: "melee-slot",
    pursuit: {
      x: input.slot.x,
      y: input.slot.y,
      z: input.slot.z,
    },
  };
}

export function selectDeterministicAttackers(input: {
  targetId: string;
  requests: readonly AttackRequest[];
}): readonly AttackRequest[] {
  return [...input.requests].sort((left, right) =>
    sortAttackers({
      targetId: input.targetId,
      leftId: left.enemy.entity.id,
      rightId: right.enemy.entity.id,
    }),
  );
}

function nonSharedSlot(input: SlotSelectionInput): MeleeSlotCandidate | undefined {
  const candidates = meleeCandidates(input.target, input.attackRange);
  const startIndex = attackSeed(input.enemy.entity.id, input.target.id);
  const count = candidates.length;
  if (count === 0) return undefined;
  const ordered = createRange(count).map(
    (offset) => candidates[(startIndex + offset) % count],
  );
  return ordered.find((candidate) => candidate !== undefined &&
    !candidate.canShare &&
    isUsableCandidate(input, candidate, { policy: "exclusive" })
  );
}
