import { TICK_DT, faceEntity, stepBody } from "@dc2d/engine";
import { findWalkableNear } from "../spawn.js";
import type { PlayerSlot, SimState } from "../state.js";
import {
  PET_DRIFT_IDLE_TICKS,
  PET_DRIFT_INTERVAL_TICKS,
  PET_PATH_RETRY_TICKS,
} from "./behaviorConstants.js";
import { PET_FOLLOW_DISTANCE_TILES, PET_TELEPORT_DISTANCE_TILES, teleportPetNearOwner } from "./leash.js";
import { clearPetPath, findPetPath, isPetDriftTargetReachable, petNeedsTraversal } from "./navigation.js";
import type { PetPathStep, PetSlot } from "./types.js";

interface FollowContext {
  sim: SimState;
  pet: PetSlot;
  owner: PlayerSlot;
  target: { x: number; y: number };
  distance: number;
}

export function stepFollowMovement(input: Omit<FollowContext, "target" | "distance">): void {
  const context = withOwnerPosition(input);
  updateOwnerIdleState(context.pet, ownerMovedSinceLastTick(context.pet, context.target));
  context.pet.lastOwnerPosition = context.target;
  if (teleportIfTooFar(context)) return;
  invalidateUnreachableDrift(context);
  if (stepAlongPetPath(context)) return;
  if (traverseIfNeeded(context)) return;
  moveTowardOwner(context);
}

function withOwnerPosition(input: Omit<FollowContext, "target" | "distance">): FollowContext {
  const { x, y } = input.owner.entity.body;
  const target = { x, y };
  return { ...input, target, distance: Math.hypot(x - input.pet.entity.body.x, y - input.pet.entity.body.y) };
}

function teleportIfTooFar({ sim, pet, owner, distance }: FollowContext): boolean {
  if (distance <= PET_TELEPORT_DISTANCE_TILES) return false;
  clearPetPath(pet, sim.tickCount);
  teleportPetNearOwner(sim, pet, owner);
  return true;
}

function invalidateUnreachableDrift({ sim, pet, target }: FollowContext): void {
  if (pet.driftTarget && !isPetDriftTargetReachable({ sim, pet, target: pet.driftTarget, owner: target })) pet.driftTarget = undefined;
}

function traverseIfNeeded(context: FollowContext): boolean {
  const needsTraversal = context.distance <= PET_FOLLOW_DISTANCE_TILES &&
    !context.pet.driftTarget && petNeedsTraversal({ sim: context.sim, pet: context.pet, target: context.target });
  if (!needsTraversal || !planPetPath(context)) return false;
  stepAlongPetPath(context);
  return true;
}

function moveTowardOwner(context: FollowContext): void {
  const target = driftTargetFor(context);
  if (reachedDriftTarget(context, target)) return;
  if (context.distance <= PET_FOLLOW_DISTANCE_TILES && !context.pet.driftTarget) return;
  if (movePet({ sim: context.sim, pet: context.pet, target }) && !context.pet.driftTarget) planPetPath(context);
}

function reachedDriftTarget({ pet }: FollowContext, target: { x: number; y: number }): boolean {
  if (!pet.driftTarget || Math.hypot(target.x - pet.entity.body.x, target.y - pet.entity.body.y) >= 0.35) return false;
  pet.driftTarget = undefined;
  return true;
}

function planPetPath({ sim, pet, target }: FollowContext): boolean {
  if (sim.tickCount < pet.nextPathTick) return pet.pathIndex < pet.path.length;
  pet.path = findPetPath({ sim, pet, target });
  pet.pathIndex = 0;
  pet.pathGoal = { x: Math.floor(target.x), y: Math.floor(target.y) };
  pet.nextPathTick = sim.tickCount + PET_PATH_RETRY_TICKS;
  return pet.path.length > 0;
}

function stepAlongPetPath(context: FollowContext): boolean {
  if (pathGoalChanged(context.pet, context.target)) return clearPath(context.pet);
  const step = context.pet.path[context.pet.pathIndex];
  if (!step) return clearPath(context.pet);
  if (advanceIfAtStep({ context, step })) return true;
  return moveAlongPathStep({ context, step });
}

function pathGoalChanged(pet: PetSlot, target: { x: number; y: number }): boolean {
  return !!pet.pathGoal && (pet.pathGoal.x !== Math.floor(target.x) || pet.pathGoal.y !== Math.floor(target.y));
}

function clearPath(pet: PetSlot): false {
  clearPetPath(pet);
  return false;
}

function advanceIfAtStep({ context, step }: { context: FollowContext; step: PetPathStep }): boolean {
  if (Math.hypot(step.x - context.pet.entity.body.x, step.y - context.pet.entity.body.y) >= 0.3) return false;
  context.pet.pathIndex++;
  return stepAlongPetPath(context);
}

function moveAlongPathStep({ context, step }: { context: FollowContext; step: PetPathStep }): boolean {
  const wantsJump = step.jump && context.pet.entity.body.grounded;
  if (wantsJump && context.pet.entity.body.jumpHeld) {
    movePet({ sim: context.sim, pet: context.pet, target: step, jump: false });
    return true;
  }
  const blocked = movePet({ sim: context.sim, pet: context.pet, target: step, jump: wantsJump });
  if (shouldRetryPath(blocked, step, context.pet)) clearPetPath(context.pet, context.sim.tickCount + PET_PATH_RETRY_TICKS);
  return true;
}

function shouldRetryPath(blocked: boolean, step: PetPathStep, pet: PetSlot): boolean {
  return blocked && (!step.jump || pet.entity.body.grounded);
}

function ownerMovedSinceLastTick(pet: PetSlot, target: { x: number; y: number }): boolean {
  const last = pet.lastOwnerPosition;
  return !last || Math.hypot(target.x - last.x, target.y - last.y) > 0.05;
}

function updateOwnerIdleState(pet: PetSlot, ownerMoved: boolean): void {
  if (ownerMoved) {
    pet.ownerStillTicks = 0;
    pet.driftTarget = undefined;
    return;
  }
  pet.ownerStillTicks++;
}

function driftTargetFor(context: FollowContext): { x: number; y: number } {
  if (context.distance > PET_FOLLOW_DISTANCE_TILES || context.pet.ownerStillTicks < PET_DRIFT_IDLE_TICKS) return context.target;
  if (!context.pet.driftTarget && context.sim.tickCount >= context.pet.nextDriftTick) chooseDriftTarget(context);
  return context.pet.driftTarget ?? context.target;
}

function chooseDriftTarget({ sim, pet, target }: FollowContext): void {
  const angle = sim.rng.next() * Math.PI * 2;
  const radius = 1 + sim.rng.next() * 1.5;
  const candidate = findWalkableNear({ sim, x: target.x + Math.cos(angle) * radius, y: target.y + Math.sin(angle) * radius, maxRadius: 2 });
  const driftTarget = candidate && { x: candidate.x + 0.5, y: candidate.y + 0.5 };
  if (driftTarget && isPetDriftTargetReachable({ sim, pet, target: driftTarget, owner: target })) pet.driftTarget = driftTarget;
  pet.nextDriftTick = sim.tickCount + PET_DRIFT_INTERVAL_TICKS;
}

function movePet({ sim, pet, target, jump = false }: { sim: SimState; pet: PetSlot; target: { x: number; y: number }; jump?: boolean }): boolean {
  const entity = pet.entity;
  const dx = target.x - entity.body.x;
  const dy = target.y - entity.body.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.05) return false;
  faceEntity(entity, dx, dy);
  const before = { x: entity.body.x, y: entity.body.y };
  const result = stepBody(sim.world, entity.body, { moveX: dx / distance, moveY: dy / distance, jump }, TICK_DT, { speed: pet.definition.speed });
  sim.replicationMotion.set(entity.id, { x: (entity.body.x - before.x) / TICK_DT, y: (entity.body.y - before.y) / TICK_DT });
  if (pet.driftTarget && (result.blockedX || result.blockedY)) pet.driftTarget = undefined;
  return Boolean(result.blockedX || result.blockedY);
}
