/**
 * Always-on gear/pencil chip: the one HUD OS entry point that toggles edit-HUD mode
 * (docs/HUD_OS.md §3 — stands in for the not-yet-built System Tray window). Tucked
 * in the bottom-right screen corner, clear of every bottom-anchored widget's own
 * offset (weaponChip/touch-buttons sit well further up from the edge). Not a
 * registry window itself — meta-chrome for editing windows, always visible, never
 * hideable. Click toggles on desktop; touch requires a long-press so a stray tap
 * near the action-button cluster can't drop a player into edit mode mid-combat.
 */
import type Phaser from "phaser";
import { uiTextStyle } from "../font.js";
import { drawPanelBackground } from "../panel.js";
import type { Viewport } from "../widgets/state.js";

const CHIP_SIZE = 28;
const CORNER_INSET = 6;
/** How long a touch must hold before edit mode opens — long enough that swiping
 * across the corner during play never triggers it (mirrors input/fistbump.ts's
 * hold-to-confirm pacing, kept local here rather than importing across lanes). */
const LONG_PRESS_MS = 450;

export class GearChip {
  private readonly container: Phaser.GameObjects.Container;
  private readonly hitArea: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private readonly scene: Phaser.Scene;
  private longPressTimer: Phaser.Time.TimerEvent | undefined;

  constructor(scene: Phaser.Scene, viewport: Viewport, depth: number, onToggle: () => void) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(depth);
    drawPanelBackground(scene, CHIP_SIZE, CHIP_SIZE).setPosition(-CHIP_SIZE, -CHIP_SIZE).setAlpha(0.9);
    this.hitArea = scene.add
      .rectangle(-CHIP_SIZE, -CHIP_SIZE, CHIP_SIZE, CHIP_SIZE, 0x000000, 0)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    this.label = scene.add.text(-CHIP_SIZE / 2, -CHIP_SIZE / 2, "⚙", uiTextStyle(15)).setOrigin(0.5, 0.5);
    this.container.add([this.hitArea, this.label]);
    this.bindPointerEvents(onToggle);
    this.reposition(viewport);
  }

  private bindPointerEvents(onToggle: () => void): void {
    this.hitArea.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.wasTouch) {
        onToggle();
        return;
      }
      this.longPressTimer = this.scene.time.delayedCall(LONG_PRESS_MS, onToggle);
    });
    this.hitArea.on("pointerup", () => this.cancelLongPress());
    this.hitArea.on("pointerout", () => this.cancelLongPress());
  }

  private cancelLongPress(): void {
    this.longPressTimer?.remove();
    this.longPressTimer = undefined;
  }

  /** Visual feedback for the current mode — gold glyph while edit-HUD is active. */
  setActive(active: boolean): void {
    this.label.setColor(active ? "#ffd23d" : "#e8e8e8");
  }

  reposition(viewport: Viewport): void {
    this.container.setPosition(viewport.width - CORNER_INSET, viewport.height - CORNER_INSET);
  }
}
