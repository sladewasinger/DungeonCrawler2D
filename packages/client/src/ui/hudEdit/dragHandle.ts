/**
 * One draggable label overlay in edit-HUD mode, one per visible registered widget —
 * rendered at the widget's own resolved anchor point (the exact point its offset math
 * measures from), so dragging the handle IS dragging the widget. Purely presentational;
 * HudEditMode (index.ts) owns the actual drag state machine and registry writes.
 */
import type Phaser from "phaser";
import { uiTextStyle } from "../font.js";
import { drawPanelBackground, drawSelectionAccent } from "../panel.js";

const HANDLE_WIDTH = 116;
const HANDLE_HEIGHT = 20;
const HANDLE_FONT_SIZE = 10;

export class DragHandle {
  readonly container: Phaser.GameObjects.Container;
  private point: { x: number; y: number };

  constructor(
    scene: Phaser.Scene,
    id: string,
    point: { x: number; y: number },
    depth: number,
    onGrab: (pointer: Phaser.Input.Pointer) => void,
  ) {
    this.point = { ...point };
    this.container = scene.add.container(point.x, point.y).setScrollFactor(0).setDepth(depth);
    const bg = drawPanelBackground(scene, HANDLE_WIDTH, HANDLE_HEIGHT).setPosition(-HANDLE_WIDTH / 2, -HANDLE_HEIGHT / 2).setAlpha(0.92);
    const accent = drawSelectionAccent(scene, HANDLE_WIDTH, HANDLE_HEIGHT).setPosition(-HANDLE_WIDTH / 2, -HANDLE_HEIGHT / 2);
    const label = scene.add.text(0, 0, id, uiTextStyle(HANDLE_FONT_SIZE, "#ffd23d")).setOrigin(0.5, 0.5);
    const hitArea = scene.add
      .rectangle(-HANDLE_WIDTH / 2, -HANDLE_HEIGHT / 2, HANDLE_WIDTH, HANDLE_HEIGHT, 0x000000, 0)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    hitArea.on("pointerdown", (pointer: Phaser.Input.Pointer) => onGrab(pointer));
    this.container.add([bg, accent, label, hitArea]);
  }

  /** Live drag feedback — moves the visual handle without touching the registry (HudEditMode commits on release). */
  moveTo(point: { x: number; y: number }): void {
    this.point = point;
    this.container.setPosition(point.x, point.y);
  }

  currentPoint(): { x: number; y: number } {
    return this.point;
  }

  destroy(): void {
    this.container.destroy();
  }
}
