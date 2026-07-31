import type Phaser from "phaser";
import type { PetEntityView } from "../../visuals/view.js";

export interface DinoBehaviorSyncInput {
  readonly view: PetEntityView;
  readonly nowMs: number;
  readonly body: Phaser.GameObjects.Sprite;
}

export interface DinoBehaviorVisual {
  sync(input: DinoBehaviorSyncInput): void;
  destroy(): void;
}
