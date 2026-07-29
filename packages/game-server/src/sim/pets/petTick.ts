import { NEUTRAL_INPUT } from "@dc2d/engine";
import type { SimState } from "../state/state.js";
import { releasePet } from "./behavior.js";
import { stepPetTowardOwner } from "./follow.js";
import { advancePetBody } from "./movement.js";
import type { PetSlot } from "./types.js";

export function stepPets(sim: SimState): void {
  for (const pet of sim.pets.values()) stepPet(sim, pet);
}

function stepPet(sim: SimState, pet: PetSlot): void {
  const owner = pet.ownerId ? sim.players.get(pet.ownerId) : undefined;
  if (!owner) {
    if (pet.ownerId !== null) releasePet(pet);
    advancePetBody({ sim, pet, move: NEUTRAL_INPUT });
    return;
  }
  if (!owner.connected || owner.entity.hp <= 0) {
    advancePetBody({ sim, pet, move: NEUTRAL_INPUT });
    return;
  }
  pet.mode = "following";
  stepPetTowardOwner(sim, pet, owner);
}
