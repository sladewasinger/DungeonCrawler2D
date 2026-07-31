import { DOUX_BEHAVIOR } from "./dinos/doux.js";
import { TARD_BEHAVIOR } from "./dinos/tard.js";
import type { PetBehaviorDefinition } from "./types.js";

const PET_BEHAVIORS = new Map<string, PetBehaviorDefinition>([
  ["pet-dino-doux", DOUX_BEHAVIOR],
  ["pet-dino-tard", TARD_BEHAVIOR],
]);

export function petBehaviorDefinition(
  definitionId: string,
): PetBehaviorDefinition | undefined {
  return PET_BEHAVIORS.get(definitionId);
}
