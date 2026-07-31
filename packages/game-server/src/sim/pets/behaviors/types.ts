import type { PetBehavior } from "@dc2d/engine";
import type { PlayerSlot, SimState } from "../../state/state.js";
import type { PetSlot } from "../types.js";

export type PetActionBehavior = Exclude<PetBehavior, "idle">;

export interface PetBehaviorState {
  current: PetBehavior;
  eventSequence: number;
  activeUntilTick: number;
  cooldownUntilTick: number;
  nextDecisionTick: number;
  wasMoving: boolean;
}

export interface PetBehaviorContext {
  readonly sim: SimState;
  readonly pet: PetSlot;
  readonly owner: PlayerSlot;
  readonly waiting: boolean;
  readonly ownerStartedMoving: boolean;
  readonly petStartedMoving: boolean;
}

export interface PetBehaviorDecision {
  readonly behavior: PetActionBehavior;
  readonly durationTicks: number;
  readonly cooldownTicks: number;
}

export interface PetBehaviorDefinition {
  readonly decisionIntervalTicks: number;
  choose(context: PetBehaviorContext): PetBehaviorDecision | undefined;
}
