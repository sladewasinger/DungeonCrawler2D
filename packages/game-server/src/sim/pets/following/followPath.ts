import { PET_PATH_RETRY_TICKS } from "../behaviorConstants.js";
import type { PetFollowContext } from "./followContext.js";
import { PET_FOLLOW_DISTANCE_TILES } from "../leash.js";
import {
  clearPetPath,
  findPetPath,
  petNeedsTraversal,
} from "../navigation.js";
import {
  steerPetAlongPath,
  type PetSteeringIntent,
} from "./followSteering.js";
import type { PetPathStep, PetSlot } from "../types.js";

export function petPathSteering(
  context: PetFollowContext,
): PetSteeringIntent | null {
  return activePathSteering(context) ?? traversalSteering(context);
}

export function planPetPath(context: PetFollowContext): boolean {
  const { sim, pet, target } = context;
  if (sim.tickCount < pet.nextPathTick) {
    return pet.pathIndex < pet.path.length;
  }
  pet.path = findPetPath({ sim, pet, target });
  pet.pathIndex = 0;
  pet.pathGoal = { x: Math.floor(target.x), y: Math.floor(target.y) };
  pet.nextPathTick = sim.tickCount + PET_PATH_RETRY_TICKS;
  return pet.path.length > 0;
}

function traversalSteering(
  context: PetFollowContext,
): PetSteeringIntent | null {
  if (!petNeedsPath(context) || !planPetPath(context)) return null;
  return activePathSteering(context);
}

function petNeedsPath(context: PetFollowContext): boolean {
  return context.distance <= PET_FOLLOW_DISTANCE_TILES &&
    !context.pet.driftTarget &&
    petNeedsTraversal({
      sim: context.sim,
      pet: context.pet,
      target: context.target,
    });
}

function activePathSteering(
  context: PetFollowContext,
): PetSteeringIntent | null {
  if (pathGoalChanged(context.pet, context.target)) {
    clearPetPath(context.pet);
    return null;
  }
  const step = nextPetPathStep(context.pet);
  return step ? steerPetAlongPath(context.pet, step) : null;
}

function nextPetPathStep(pet: PetSlot): PetPathStep | undefined {
  let step = pet.path[pet.pathIndex];
  while (step && reachedPetPathStep(pet, step)) {
    pet.pathIndex++;
    step = pet.path[pet.pathIndex];
  }
  if (!step) clearPetPath(pet);
  return step;
}

function reachedPetPathStep(pet: PetSlot, step: PetPathStep): boolean {
  return Math.hypot(
    step.x - pet.entity.body.x,
    step.y - pet.entity.body.y,
  ) < 0.3;
}

function pathGoalChanged(
  pet: PetSlot,
  target: { readonly x: number; readonly y: number },
): boolean {
  return pet.pathGoal !== undefined &&
    (pet.pathGoal.x !== Math.floor(target.x) ||
      pet.pathGoal.y !== Math.floor(target.y));
}
