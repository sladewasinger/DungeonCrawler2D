import { findWalkableNear } from "../spawn/spawn.js";
import type { SimState } from "../state/state.js";
import {
  PET_DRIFT_IDLE_TICKS,
  PET_DRIFT_INTERVAL_TICKS,
} from "./behaviorConstants.js";
import { PET_FOLLOW_DISTANCE_TILES } from "./leash.js";
import { isPetDriftTargetReachable } from "./navigation.js";
import type { PetSlot } from "./types.js";

interface PetIdleContext {
  readonly sim: SimState;
  readonly pet: PetSlot;
  readonly owner: { readonly x: number; readonly y: number };
  readonly distance: number;
}

export function updatePetOwnerIdle(
  pet: PetSlot,
  owner: { readonly x: number; readonly y: number },
): void {
  const last = pet.lastOwnerPosition;
  const moved = !last ||
    Math.hypot(owner.x - last.x, owner.y - last.y) > 0.05;
  pet.lastOwnerPosition = owner;
  if (!moved) {
    pet.ownerStillTicks++;
    return;
  }
  pet.ownerStillTicks = 0;
  pet.driftTarget = undefined;
}

export function validPetDriftTarget(input: PetIdleContext): void {
  const target = input.pet.driftTarget;
  if (!target) return;
  if (isPetDriftTargetReachable({
    sim: input.sim,
    pet: input.pet,
    target,
    owner: input.owner,
  })) return;
  input.pet.driftTarget = undefined;
}

export function petIdleTarget(
  input: PetIdleContext,
): { readonly x: number; readonly y: number } {
  if (!shouldDrift(input)) return input.owner;
  if (!input.pet.driftTarget &&
      input.sim.tickCount >= input.pet.nextDriftTick) {
    choosePetDriftTarget(input);
  }
  return input.pet.driftTarget ?? input.owner;
}

function shouldDrift(input: PetIdleContext): boolean {
  return input.distance <= PET_FOLLOW_DISTANCE_TILES &&
    input.pet.ownerStillTicks >= PET_DRIFT_IDLE_TICKS;
}

function choosePetDriftTarget(input: PetIdleContext): void {
  const angle = input.sim.rng.next() * Math.PI * 2;
  const radius = 1 + input.sim.rng.next() * 1.5;
  const candidate = findWalkableNear({
    sim: input.sim,
    x: input.owner.x + Math.cos(angle) * radius,
    y: input.owner.y + Math.sin(angle) * radius,
    maxRadius: 2,
  });
  const target = candidate && {
    x: candidate.x + 0.5,
    y: candidate.y + 0.5,
  };
  if (target && isPetDriftTargetReachable({
    sim: input.sim,
    pet: input.pet,
    target,
    owner: input.owner,
  })) input.pet.driftTarget = target;
  input.pet.nextDriftTick =
    input.sim.tickCount + PET_DRIFT_INTERVAL_TICKS;
}
