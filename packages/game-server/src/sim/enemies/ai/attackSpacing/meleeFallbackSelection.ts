import {
  attackSeed,
  meleeCandidates,
} from "./attackSpacingUtils.js";
import {
  candidateOverlapCount,
  createRange,
  isUsableCandidate,
} from "./meleeSlotSelectionHelpers.js";
import type {
  MeleeSlotCandidate,
  SlotSelectionInput,
} from "./attackSpacingTypes.js";

export function fallbackMeleeApproachPoint(
  input: SlotSelectionInput,
): MeleeSlotCandidate | undefined {
  const candidates = orderedMeleeCandidates(input);
  const usable = candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => candidate.canShare === false &&
      isUsableCandidate(input, candidate, { policy: "bounded-fallback" }));
  usable.sort((left, right) => candidateOverlapCount(input, left.candidate) -
    candidateOverlapCount(input, right.candidate) || left.index - right.index);
  return usable[0]?.candidate;
}

function orderedMeleeCandidates(input: SlotSelectionInput): readonly MeleeSlotCandidate[] {
  const candidates = meleeCandidates(input.target, input.attackRange);
  const startIndex = attackSeed(input.enemy.entity.id, input.target.id);
  return createRange(candidates.length).map((offset) =>
    candidates[(startIndex + offset) % candidates.length]!,
  );
}
