import type Phaser from "phaser";

export interface StatusVisualFrame {
  groundScreenY: number;
  nowMs: number;
  burning: boolean;
  oiled: boolean;
}

export interface StatusCombatantVisual {
  readonly body: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Ellipse;
}

export interface StatusCombatantView {
  readonly fx: readonly string[];
  readonly hp: number;
}
