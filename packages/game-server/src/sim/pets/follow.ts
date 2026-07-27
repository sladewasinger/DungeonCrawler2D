import {
  TICK_DT,
  faceEntity,
  stepBody,
} from "@dc2d/engine";
import { findWalkableNear } from "../spawn.js";
import type { PlayerSlot, SimState } from "../state.js";
import {
  PET_DRIFT_IDLE_TICKS,
  PET_DRIFT_INTERVAL_TICKS,
  PET_PATH_RETRY_TICKS,
} from "./behaviorConstants.js";
import {
  PET_FOLLOW_DISTANCE_TILES,
  PET_TELEPORT_DISTANCE_TILES,
  teleportPetNearOwner,
} from "./leash.js";
import {
  clearPetPath,
  findPetPath,
  isPetDriftTargetReachable,
  petNeedsTraversal,
} from "./navigation.js";
import type { PetPathStep, PetSlot } from "./types.js";

export function stepPetTowardOwner(sim: SimState, pet: PetSlot, owner: PlayerSlot): void {
  const ownerX = owner.entity.body.x;
  const ownerY = owner.entity.body.y;
  const ownerMoved = ownerMovedSinceLastTick(pet, ownerX, ownerY);
  pet.lastOwnerPosition = { x: ownerX, y: ownerY };
  updateOwnerIdleState(pet, ownerMoved);
  const distance = Math.hypot(ownerX - pet.entity.body.x, ownerY - pet.entity.body.y);
  if (teleportIfTooFar(sim, pet, owner, distance)) return;
  invalidateUnreachableDrift(sim, pet, ownerX, ownerY);
  if (stepAlongPetPath(sim, pet, ownerX, ownerY)) return;
  if (traverseIfNeeded(sim, pet, ownerX, ownerY, distance)) return;
  moveTowardOwner(sim, pet, ownerX, ownerY, distance);
}

function teleportIfTooFar(sim: SimState, pet: PetSlot, owner: PlayerSlot, distance: number): boolean {
  if (distance <= PET_TELEPORT_DISTANCE_TILES) return false;
  clearPetPath(pet, sim.tickCount);
  teleportPetNearOwner(sim, pet, owner);
  return true;
}

function invalidateUnreachableDrift(sim: SimState, pet: PetSlot, ownerX: number, ownerY: number): void {
  if (pet.driftTarget && !isPetDriftTargetReachable(sim, pet, pet.driftTarget, ownerX, ownerY)) {
    pet.driftTarget = undefined;
  }
}

function traverseIfNeeded(
  sim: SimState,
  pet: PetSlot,
  ownerX: number,
  ownerY: number,
  distance: number,
): boolean {
  const needsTraversal = distance <= PET_FOLLOW_DISTANCE_TILES &&
    !pet.driftTarget && petNeedsTraversal(sim, pet, ownerX, ownerY);
  if (!needsTraversal || !planPetPath(sim, pet, ownerX, ownerY)) return false;
  stepAlongPetPath(sim, pet, ownerX, ownerY);
  return true;
}

function moveTowardOwner(
  sim: SimState,
  pet: PetSlot,
  ownerX: number,
  ownerY: number,
  distance: number,
): void {
  const target = driftTargetFor(sim, pet, ownerX, ownerY, distance);
  if (pet.driftTarget && Math.hypot(target.x - pet.entity.body.x, target.y - pet.entity.body.y) < 0.35) {
    pet.driftTarget = undefined;
    return;
  }
  if (distance <= PET_FOLLOW_DISTANCE_TILES && !pet.driftTarget) return;
  const blocked = movePet(sim, pet, target);
  if (blocked && !pet.driftTarget) planPetPath(sim, pet, ownerX, ownerY);
}

function planPetPath(sim: SimState, pet: PetSlot, ownerX: number, ownerY: number): boolean {
  if (sim.tickCount < pet.nextPathTick) return pet.pathIndex < pet.path.length;
  pet.path = findPetPath(sim, pet, ownerX, ownerY);
  pet.pathIndex = 0;
  pet.pathGoal = { x: Math.floor(ownerX), y: Math.floor(ownerY) };
  pet.nextPathTick = sim.tickCount + PET_PATH_RETRY_TICKS;
  return pet.path.length > 0;
}

function stepAlongPetPath(sim: SimState, pet: PetSlot, ownerX: number, ownerY: number): boolean {
  if (pathGoalChanged(pet, ownerX, ownerY)) {
    clearPetPath(pet);
    return false;
  }
  const step = pet.path[pet.pathIndex];
  if (!step) {
    clearPetPath(pet);
    return false;
  }
  if (advanceIfAtStep(pet, step, ownerX, ownerY, sim)) return true;
  return moveAlongPathStep(sim, pet, step);
}

function pathGoalChanged(pet: PetSlot, ownerX: number, ownerY: number): boolean {
  return !!pet.pathGoal && (
    pet.pathGoal.x !== Math.floor(ownerX) || pet.pathGoal.y !== Math.floor(ownerY)
  );
}

function advanceIfAtStep(
  pet: PetSlot,
  step: PetPathStep,
  ownerX: number,
  ownerY: number,
  sim: SimState,
): boolean {
  if (Math.hypot(step.x - pet.entity.body.x, step.y - pet.entity.body.y) >= 0.3) return false;
  pet.pathIndex++;
  return stepAlongPetPath(sim, pet, ownerX, ownerY);
}

function moveAlongPathStep(sim: SimState, pet: PetSlot, step: PetPathStep): boolean {
  const wasGrounded = pet.entity.body.grounded;
  const wantsJump = step.jump && wasGrounded;
  if (wantsJump && pet.entity.body.jumpHeld) {
    movePet(sim, pet, step, false);
    return true;
  }
  const blocked = movePet(sim, pet, step, wantsJump);
  if (blocked && !(step.jump && !pet.entity.body.grounded)) {
    clearPetPath(pet, sim.tickCount + PET_PATH_RETRY_TICKS);
  }
  return true;
}

function ownerMovedSinceLastTick(pet: PetSlot, x: number, y: number): boolean {
  const last = pet.lastOwnerPosition;
  return !last || Math.hypot(x - last.x, y - last.y) > 0.05;
}

function updateOwnerIdleState(pet: PetSlot, ownerMoved: boolean): void {
  if (ownerMoved) {
    pet.ownerStillTicks = 0;
    pet.driftTarget = undefined;
    return;
  }
  pet.ownerStillTicks++;
}

function driftTargetFor(
  sim: SimState,
  pet: PetSlot,
  ownerX: number,
  ownerY: number,
  distance: number,
): { x: number; y: number } {
  if (distance > PET_FOLLOW_DISTANCE_TILES || pet.ownerStillTicks < PET_DRIFT_IDLE_TICKS) {
    return { x: ownerX, y: ownerY };
  }
  if (!pet.driftTarget && sim.tickCount >= pet.nextDriftTick) chooseDriftTarget(sim, pet, ownerX, ownerY);
  return pet.driftTarget ?? { x: ownerX, y: ownerY };
}

function chooseDriftTarget(sim: SimState, pet: PetSlot, ownerX: number, ownerY: number): void {
  const angle = sim.rng.next() * Math.PI * 2;
  const radius = 1 + sim.rng.next() * 1.5;
  const candidate = findWalkableNear(sim, ownerX + Math.cos(angle) * radius, ownerY + Math.sin(angle) * radius, 2);
  const target = candidate && { x: candidate.x + 0.5, y: candidate.y + 0.5 };
  if (target && isPetDriftTargetReachable(sim, pet, target, ownerX, ownerY)) pet.driftTarget = target;
  pet.nextDriftTick = sim.tickCount + PET_DRIFT_INTERVAL_TICKS;
}

function movePet(sim: SimState, pet: PetSlot, target: { x: number; y: number }, jump = false): boolean {
  const entity = pet.entity;
  const dx = target.x - entity.body.x;
  const dy = target.y - entity.body.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.05) return false;
  faceEntity(entity, dx, dy);
  const before = { x: entity.body.x, y: entity.body.y };
  const result = stepBody(sim.world, entity.body, {
    moveX: dx / distance,
    moveY: dy / distance,
    jump,
  }, TICK_DT, { speed: pet.definition.speed });
  sim.replicationMotion.set(entity.id, {
    x: (entity.body.x - before.x) / TICK_DT,
    y: (entity.body.y - before.y) / TICK_DT,
  });
  if (pet.driftTarget && (result.blockedX || result.blockedY)) pet.driftTarget = undefined;
  return Boolean(result.blockedX || result.blockedY);
}
