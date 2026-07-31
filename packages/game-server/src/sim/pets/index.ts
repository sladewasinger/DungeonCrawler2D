export {
  PET_DRIFT_IDLE_TICKS,
  PET_DRIFT_INTERVAL_TICKS,
  PET_SPAWN_DISTANCE_TILES,
  claimNearestPet,
  seedPets,
  spawnPet,
  spawnPetForPlayer,
} from "./behavior.js";
export { stepPets } from "./petTick.js";
export { type PetBehaviorState } from "./behaviors/types.js";
export { clearPetPath } from "./navigation.js";
export {
  PET_FOLLOW_DISTANCE_TILES,
  PET_TELEPORT_DISTANCE_TILES,
  PET_TELEPORT_EXTRA_DISTANCE_TILES,
} from "./leash.js";
export { PET_DEFINITIONS, type PetDefinition, type PetMode, type PetSlot } from "./types.js";
