import type { StepResult } from "@dc2d/engine";
import { PET_PATH_RETRY_TICKS } from "../behaviorConstants.js";
import {
  petFollowContext,
  type PetFollowContext,
} from "./followContext.js";
import { petPathSteering, planPetPath } from "./followPath.js";
import {
  petIdleTarget,
  updatePetOwnerIdle,
  validPetDriftTarget,
} from "../idleDrift.js";
import {
  PET_FOLLOW_DISTANCE_TILES,
  PET_TELEPORT_DISTANCE_TILES,
  teleportPetNearOwner,
} from "../leash.js";
import { advancePetBody } from "../movement.js";
import { clearPetPath } from "../navigation.js";
import {
  idlePetSteering,
  petMovementWasBlocked,
  shouldRetryPetPath,
  steerPetToward,
  type PetSteeringIntent,
} from "./followSteering.js";
import type { PetSlot } from "../types.js";

export function stepFollowMovement(
  input: Omit<PetFollowContext, "target" | "distance">,
): void {
  const context = petFollowContext(input);
  updatePetOwnerIdle(context.pet, context.target);
  const intent = choosePetSteering(context);
  const result = advancePetBody({
    sim: context.sim,
    pet: context.pet,
    move: intent.move,
  });
  resolvePetMovement(context, intent, result);
}

function choosePetSteering(context: PetFollowContext): PetSteeringIntent {
  if (teleportIfTooFar(context)) return idlePetSteering();
  validPetDriftTarget({
    sim: context.sim,
    pet: context.pet,
    owner: context.target,
    distance: context.distance,
  });
  return petPathSteering(context) ?? ownerSteering(context);
}

function teleportIfTooFar(context: PetFollowContext): boolean {
  if (context.distance <= PET_TELEPORT_DISTANCE_TILES) return false;
  clearPetPath(context.pet, context.sim.tickCount);
  teleportPetNearOwner(context.sim, context.pet, context.owner);
  return true;
}

function ownerSteering(context: PetFollowContext): PetSteeringIntent {
  const target = petIdleTarget({
    sim: context.sim,
    pet: context.pet,
    owner: context.target,
    distance: context.distance,
  });
  if (reachedDriftTarget(context.pet, target)) return idlePetSteering();
  if (context.distance <= PET_FOLLOW_DISTANCE_TILES &&
      !context.pet.driftTarget) return idlePetSteering();
  return steerPetToward({
    pet: context.pet,
    target,
    source: "owner",
  });
}

function reachedDriftTarget(
  pet: PetSlot,
  target: { readonly x: number; readonly y: number },
): boolean {
  if (!pet.driftTarget ||
      Math.hypot(target.x - pet.entity.body.x, target.y - pet.entity.body.y) >=
        0.35) return false;
  pet.driftTarget = undefined;
  return true;
}

function resolvePetMovement(
  context: PetFollowContext,
  intent: PetSteeringIntent,
  result: StepResult,
): void {
  if (!petMovementWasBlocked(result)) return;
  if (context.pet.driftTarget) {
    context.pet.driftTarget = undefined;
    return;
  }
  if (shouldRetryPetPath(context.pet, intent, result)) {
    clearPetPath(
      context.pet,
      context.sim.tickCount + PET_PATH_RETRY_TICKS,
    );
    return;
  }
  if (intent.source === "owner") planPetPath(context);
}
