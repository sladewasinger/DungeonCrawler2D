import { MOVE_SPEED, type Entity } from "@dc2d/engine";
import type { PetBehaviorState } from "./behaviors/types.js";

/** Pet content is deliberately independent from enemy definitions. New
 * abilities can hang off this state without turning pets into combatants. */
export interface PetDefinition {
  readonly id: string;
  readonly name: string;
  readonly species: "dino" | "dog";
  readonly speed: number;
}

export const PET_DEFINITIONS: readonly PetDefinition[] = [
  { id: "pet-dino-doux", name: "Doux", species: "dino", speed: MOVE_SPEED },
  { id: "pet-dino-mort", name: "Mort", species: "dino", speed: MOVE_SPEED },
  { id: "pet-dino-tard", name: "Tard", species: "dino", speed: MOVE_SPEED },
  { id: "pet-dino-vita", name: "Vita", species: "dino", speed: MOVE_SPEED },
  { id: "pet-dog", name: "Dungeon Dog", species: "dog", speed: MOVE_SPEED },
];

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
