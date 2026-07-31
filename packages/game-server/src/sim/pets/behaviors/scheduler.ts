import { PET_DRIFT_IDLE_TICKS } from "../behaviorConstants.js";
import { PET_FOLLOW_DISTANCE_TILES } from "../leash.js";
import { petBehaviorDefinition } from "./registry.js";
import type {
  PetBehaviorContext,
  PetBehaviorDecision,
  PetBehaviorState,
} from "./types.js";
import type { PlayerSlot, SimState } from "../../state/state.js";
import type { PetSlot } from "../types.js";

export function initialPetBehavior(): PetBehaviorState {
  return {
    current: "idle",
    eventSequence: 0,
    activeUntilTick: 0,
    cooldownUntilTick: 0,
    nextDecisionTick: 0,
    wasMoving: false,
  };
}

export function resetPetBehavior(pet: PetSlot): void {
  const eventSequence = pet.behavior.eventSequence;
  pet.behavior = { ...initialPetBehavior(), eventSequence };
}

export function stepPetBehavior(
  sim: SimState,
  pet: PetSlot,
  owner: PlayerSlot,
): void {
  const definition = petBehaviorDefinition(pet.definition.id);
  if (!definition) return;
  const context = behaviorContext(sim, pet, owner);
  pet.behavior.wasMoving = petIsMoving(sim, pet);
  expireBehavior(pet.behavior, sim.tickCount, context.waiting);
  if (pet.behavior.current !== "idle" ||
      sim.tickCount < pet.behavior.cooldownUntilTick) return;
  if (!context.ownerStartedMoving && !context.petStartedMoving &&
      sim.tickCount < pet.behavior.nextDecisionTick) return;
  const decision = definition.choose(context);
  pet.behavior.nextDecisionTick =
    sim.tickCount + definition.decisionIntervalTicks;
  if (!decision) return;
  startBehavior(pet.behavior, sim.tickCount, decision);
}

function behaviorContext(
  sim: SimState,
  pet: PetSlot,
  owner: PlayerSlot,
): PetBehaviorContext {
  const distance = Math.hypot(
    owner.entity.body.x - pet.entity.body.x,
    owner.entity.body.y - pet.entity.body.y,
  );
  return {
    sim,
    pet,
    owner,
    waiting: isWaiting(pet, distance),
    ownerStartedMoving: ownerStartedMoving(sim, pet, owner),
    petStartedMoving: petStartedMoving(sim, pet),
  };
}

function petStartedMoving(sim: SimState, pet: PetSlot): boolean {
  return petIsMoving(sim, pet) && !pet.behavior.wasMoving;
}

function petIsMoving(sim: SimState, pet: PetSlot): boolean {
  const motion = sim.replicationMotion.get(pet.entity.id);
  return Boolean(motion && Math.hypot(motion.x, motion.y) > 0.05);
}

function isWaiting(pet: PetSlot, distance: number): boolean {
  return pet.ownerStillTicks >= PET_DRIFT_IDLE_TICKS &&
    distance <= PET_FOLLOW_DISTANCE_TILES &&
    pet.driftTarget === undefined &&
    pet.pathIndex >= pet.path.length;
}

function ownerStartedMoving(
  sim: SimState,
  pet: PetSlot,
  owner: PlayerSlot,
): boolean {
  if (pet.ownerStillTicks < PET_DRIFT_IDLE_TICKS) return false;
  const motion = sim.replicationMotion.get(owner.entity.id);
  if (motion && Math.hypot(motion.x, motion.y) > 0.05) return true;
  const last = pet.lastOwnerPosition;
  return last !== undefined && Math.hypot(
    owner.entity.body.x - last.x,
    owner.entity.body.y - last.y,
  ) > 0.05;
}

function expireBehavior(
  state: PetBehaviorState,
  tick: number,
  waiting: boolean,
): void {
  if (state.current === "tail_chase" && !waiting) {
    state.current = "idle";
    return;
  }
  if (state.current !== "idle" && tick >= state.activeUntilTick) {
    state.current = "idle";
  }
}

function startBehavior(
  state: PetBehaviorState,
  tick: number,
  decision: PetBehaviorDecision,
): void {
  state.current = decision.behavior;
  state.activeUntilTick = tick + decision.durationTicks;
  state.cooldownUntilTick = tick + decision.cooldownTicks;
  state.eventSequence++;
}
