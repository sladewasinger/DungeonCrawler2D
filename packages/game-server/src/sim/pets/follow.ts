import type { PlayerSlot, SimState } from "../state/state.js";
import { stepFollowMovement } from "./following/followMovement.js";
import type { PetSlot } from "./types.js";

export function stepPetTowardOwner(sim: SimState, pet: PetSlot, owner: PlayerSlot): void {
  stepFollowMovement({ sim, pet, owner });
}
