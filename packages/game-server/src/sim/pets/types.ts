import type { Entity, PetDefinition } from "@dc2d/engine";
import type { PetBehaviorState } from "./behaviors/types.js";

export { PET_DEFINITIONS, type PetDefinition } from "@dc2d/engine";

export type PetMode = "available" | "following";

export interface PetPathStep {
  x: number;
  y: number;
  jump: boolean;
}

export interface PetSlot {
  readonly entity: Entity;
  readonly definition: PetDefinition;
  readonly home: { readonly x: number; readonly y: number };
  ownerId: string | null;
  mode: PetMode;
  /** Future ability hooks live here instead of being inferred from ownerId. */
  abilities: {
    attack: boolean;
    collectLoot: boolean;
  };
  ownerStillTicks: number;
  lastOwnerPosition: { x: number; y: number } | undefined;
  driftTarget: { x: number; y: number } | undefined;
  nextDriftTick: number;
  path: PetPathStep[];
  pathIndex: number;
  nextPathTick: number;
  pathGoal: { x: number; y: number } | undefined;
  behavior: PetBehaviorState;
}
