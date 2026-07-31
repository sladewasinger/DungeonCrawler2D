import type { PlayerSlot, SimState } from "../state/state.js";
import { clearPetPath } from "./navigation.js";
import type { PetSlot } from "./types.js";

export function assignPetToOwner(pet: PetSlot, owner: PlayerSlot): void {
  pet.ownerId = owner.entity.id;
  pet.mode = "following";
  pet.entity.ownerId = owner.entity.id;
  pet.lastOwnerPosition = { x: owner.entity.body.x, y: owner.entity.body.y };
  pet.ownerStillTicks = 0;
  pet.driftTarget = undefined;
  clearPetPath(pet);
}

/** Deletes a replaced companion and all of its per-entity transient state. */
export function removePetOwnedByPlayer(sim: SimState, playerId: string): void {
  for (const [id, pet] of sim.pets) {
    if (pet.ownerId !== playerId) continue;
    sim.pets.delete(id);
    sim.replicationMotion.delete(id);
  }
}
