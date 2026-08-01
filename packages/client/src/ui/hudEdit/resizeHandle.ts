import type Phaser from "phaser";
import { uiTextStyle } from "../foundation/font.js";
import { drawPanelBackground } from "../foundation/panel.js";

interface ResizeHandleOptions {
  scene: Phaser.Scene;
  point: { x: number; y: number };
  depth: number;
  onGrab: (pointer: Phaser.Input.Pointer) => void;
}

export class ResizeHandle {
  readonly container: Phaser.GameObjects.Container;

  constructor({ scene, point, depth, onGrab }: ResizeHandleOptions) {
    this.container = scene.add.container(point.x, point.y).setScrollFactor(0).setDepth(depth);
    const background = drawPanelBackground(scene, 20, 20).setPosition(-10, -10).setAlpha(0.95);
    const label = scene.add.text(0, 0, "↗", uiTextStyle(12, "#ffd23d")).setOrigin(0.5);
    const hitArea = scene.add.rectangle(-10, -10, 20, 20, 0x000000, 0).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    hitArea.on("pointerdown", (pointer: Phaser.Input.Pointer) => onGrab(pointer));
    this.container.add([background, label, hitArea]);
  }

  destroy(): void { this.container.destroy(); }
}
