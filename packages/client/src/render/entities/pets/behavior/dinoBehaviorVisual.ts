import type Phaser from "phaser";
import { createDouxBehaviorVisual } from "./dinos/doux.js";
import { createTardBehaviorVisual } from "./dinos/tard.js";
import type {
  DinoBehaviorSyncInput,
  DinoBehaviorVisual,
} from "./types.js";

export type { DinoBehaviorVisual } from "./types.js";

export function createDinoBehaviorVisual(
  scene: Phaser.Scene,
  defId: string,
): DinoBehaviorVisual {
  if (defId === "pet-dino-tard") return createTardBehaviorVisual(scene);
  if (defId === "pet-dino-doux") return createDouxBehaviorVisual();
  return { sync: () => undefined, destroy: () => undefined };
}

export function syncDinoBehaviorVisual(
  input: DinoBehaviorSyncInput & { readonly behavior: DinoBehaviorVisual },
): void {
  input.behavior.sync(input);
}
