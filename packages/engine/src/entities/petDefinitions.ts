import { MOVE_SPEED } from "../core/constants.js";

/** Shared companion definitions used by the simulation and admin catalog. */
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
