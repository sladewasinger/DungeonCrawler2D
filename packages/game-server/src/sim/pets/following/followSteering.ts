import {
  NEUTRAL_INPUT,
  type MoveInput,
  type StepResult,
} from "@dc2d/engine";
import type { PetPathStep, PetSlot } from "../types.js";

export interface PetSteeringIntent {
  readonly move: MoveInput;
  readonly source: "idle" | "owner" | "path";
  readonly pathStep?: PetPathStep;
}

interface PetTargetSteering {
  readonly pet: PetSlot;
  readonly target: { readonly x: number; readonly y: number };
  readonly jump?: boolean;
  readonly source: "owner" | "path";
  readonly pathStep?: PetPathStep;
}

export function idlePetSteering(): PetSteeringIntent {
  return { move: NEUTRAL_INPUT, source: "idle" };
}

export function steerPetAlongPath(
  pet: PetSlot,
  step: PetPathStep,
): PetSteeringIntent {
  const wantsJump = step.jump && pet.entity.body.grounded;
  return steerPetToward({
    pet,
    target: step,
    jump: wantsJump && !pet.entity.body.jumpHeld,
    source: "path",
    pathStep: step,
  });
}

export function steerPetToward(
  input: PetTargetSteering,
): PetSteeringIntent {
  const body = input.pet.entity.body;
  const dx = input.target.x - body.x;
  const dy = input.target.y - body.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.05) return idlePetSteering();
  return {
    move: {
      moveX: dx / distance,
      moveY: dy / distance,
      jump: input.jump ?? false,
    },
    source: input.source,
    ...(input.pathStep ? { pathStep: input.pathStep } : {}),
  };
}

export function petMovementWasBlocked(result: StepResult): boolean {
  return Boolean(result.blockedX || result.blockedY);
}

export function shouldRetryPetPath(
  pet: PetSlot,
  intent: PetSteeringIntent,
  result: StepResult,
): boolean {
  if (!petMovementWasBlocked(result) ||
      intent.source !== "path" ||
      !intent.pathStep) return false;
  return !intent.pathStep.jump || pet.entity.body.grounded;
}
