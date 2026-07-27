import type { PlayerSlot, SimState } from "../state.js";
import { stepFollowMovement } from "./followMovement.js";
import type { PetSlot } from "./types.js";

export function stepPetTowardOwner(sim: SimState, pet: PetSlot, owner: PlayerSlot): void {
  stepFollowMovement({ sim, pet, owner });
}
