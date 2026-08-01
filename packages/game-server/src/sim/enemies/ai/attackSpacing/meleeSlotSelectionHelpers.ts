import { ENEMY_SIMULATION_TUNING } from "../../configuration/enemySimulationTuning.js";
import {
  combatHurtbox,
  hasTerrainLineOfSight,
  reachesHurtbox,
  verticalRangeIntersectsHurtbox,
  type Entity,
} from "@dc2d/engine";
import {
  ATTACK_KIND,
  type MeleeSlotCandidate,
  type SlotSelectionInput,
} from "./attackSpacingTypes.js";
import {
  meleeCandidates,
  slotReachable,
  slotWalkable,
} from "./attackSpacingUtils.js";
import type { EnemySlot } from "../../../state/state.js";

export interface MeleeStrikeInput {
  enemy: Pick<EnemySlot, "entity">;
  target: Entity;
  attackRange: number;
  decision: { strike?: unknown };
}

export type MeleeCandidatePolicy = "exclusive" | "bounded-fallback";

export interface CandidateUsabilityPolicy {
  readonly policy: MeleeCandidatePolicy;
  readonly requireReachability?: boolean;
}

export function canStrikeNow(input: MeleeStrikeInput): boolean {
  const inHeight = Math.abs(
    input.enemy.entity.body.z - input.target.body.z,
  ) <= ENEMY_SIMULATION_TUNING.perception.maximumMeleeHeightDifference;
  return inHeight && reachesHurtbox(
    input.enemy.entity,
    input.target,
    input.attackRange,
  ) && verticalRangeIntersectsHurtbox(
    input.enemy.entity.body.z - ENEMY_SIMULATION_TUNING.perception.maximumMeleeHeightDifference,
    input.enemy.entity.body.z + ENEMY_SIMULATION_TUNING.perception.maximumMeleeHeightDifference,
    input.target,
  );
}

export function isUsableCandidate(
  input: SlotSelectionInput,
  candidate: MeleeSlotCandidate,
  policy: CandidateUsabilityPolicy,
): boolean {
  if (!baseCandidateIsUsable(input, candidate, policy)) return false;
  const overlapCount = candidateOverlapCount(input, candidate);
  return policy.policy === "exclusive" ? overlapCount === 0 : overlapCount <= 1;
}

function baseCandidateIsUsable(
  input: SlotSelectionInput,
  candidate: MeleeSlotCandidate,
  policy: CandidateUsabilityPolicy,
): boolean {
  if (candidate.canShare) return false;
  if (!candidateElevationIsAllowed(input, candidate)) return false;
  if (!slotWalkable(input.sim, input.enemy, candidate)) return false;
  if (policy.requireReachability !== false &&
      !slotReachable(input.sim, input.enemy, candidate)) return false;
  return hasTerrainLineOfSight({
    world: input.sim.world,
    from: { ...candidate },
    to: input.target.body,
    maximumHeightDifference:
      ENEMY_SIMULATION_TUNING.perception.maximumVisibleHeightDifference,
  });
}

function candidateElevationIsAllowed(
  input: SlotSelectionInput,
  candidate: MeleeSlotCandidate,
): boolean {
  const candidateGround = input.sim.world.groundAt(candidate.x, candidate.y);
  return Math.abs(candidateGround - input.target.body.z) <=
    ENEMY_SIMULATION_TUNING.perception.maximumMeleeHeightDifference;
}

export function candidateOverlapCount(
  input: SlotSelectionInput,
  candidate: MeleeSlotCandidate,
): number {
  const candidateHurtbox = combatHurtbox(input.enemy.entity);
  return input.occupied.filter((occupant) => {
    if (occupant.enemy.entity.id === input.enemy.entity.id) return false;
    const occupiedHurtbox = combatHurtbox(occupant.enemy.entity);
    const horizontalOverlap = Math.abs(candidate.x - occupant.slot.x) <=
      candidateHurtbox.halfWidth + occupiedHurtbox.halfWidth;
    const depthOverlap = Math.abs(candidate.y - occupant.slot.y) <=
      candidateHurtbox.halfDepth + occupiedHurtbox.halfDepth;
    const candidateBottom = candidate.z - candidateHurtbox.bottomOffset;
    const occupiedBottom = occupant.slot.z - occupiedHurtbox.bottomOffset;
    const verticalOverlap = candidateBottom <= occupiedBottom + occupiedHurtbox.height &&
      occupiedBottom <= candidateBottom + candidateHurtbox.height;
    return horizontalOverlap && depthOverlap && verticalOverlap;
  }).length;
}

export function isCurrentMeleeCandidate(
  input: SlotSelectionInput,
  reservation: { x: number; y: number; z: number },
): boolean {
  return meleeCandidates(input.target, input.attackRange).some((candidate) =>
    candidateMatch(candidate, reservation),
  );
}

export function reuseMeleeSlot(
  input: SlotSelectionInput,
): MeleeSlotCandidate | undefined {
  const reservation = input.enemy.attackReservation;
  if (!reservation || reservation.kind !== ATTACK_KIND.meleeSlot) return undefined;
  if (reservation.targetId !== input.target.id) return undefined;
  if (!isCurrentMeleeCandidate(input, reservation)) return undefined;
  const candidate: MeleeSlotCandidate = {
    x: reservation.x,
    y: reservation.y,
    z: reservation.z,
    canShare: false,
  };
  if (!isUsableCandidate(input, candidate, {
    policy: "bounded-fallback",
    requireReachability: false,
  })) {
    return undefined;
  }
  return candidate;
}

function candidateMatch(
  candidate: MeleeSlotCandidate,
  reservation: { x: number; y: number; z: number },
): boolean {
  return candidate.x === reservation.x &&
    candidate.y === reservation.y &&
    candidate.z === reservation.z;
}

export function createRange(count: number): number[] {
  const values: number[] = [];
  for (let index = 0; index < count; index++) {
    values.push(index);
  }
  return values;
}
