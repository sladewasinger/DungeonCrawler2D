/**
 * Death/downed overlay HUD widget: a dark vignette + centered respawn text, hidden
 * unless the player is downed. Sized to the viewport, but still registry-anchored at
 * "center" so its screen coverage stays a resolved layout, not a hardcoded rect.
 */
import type Phaser from "phaser";
import { uiTextStyle } from "../../font.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";

const WIDGET_ID = "death";
const VIGNETTE_COLOR = 0x0a0a10;
const VIGNETTE_ALPHA = 0.72;
const HOLD_BAR_WIDTH = 220;
const HOLD_BAR_HEIGHT = 10;

function barPresentation(downed: boolean, dead: boolean, hold: number, revive: number) {
  const progress = downed ? revive : hold;
  return { progress, visible: dead || progress > 0 };
}

export const deathOverlayText = (remainingSec: number): string =>
  `YOU DIED\nRespawning in ${Math.max(0, Math.ceil(remainingSec))}s\nHold [E] for 3s to respawn now`;

export const downedOverlayText = (remainingSec: number, reviverName: string | null): string =>
  `DOWNED\nBleeding out in ${Math.max(0, Math.ceil(remainingSec))}s\n` +
  (reviverName ? `${reviverName} is reviving you` : "Hold [K] to give up\nAny nearby player can revive you");

export class DeathOverlayWidget {
  private readonly container: Phaser.GameObjects.Container;
  private readonly vignette: Phaser.GameObjects.Rectangle;
  private readonly text: Phaser.GameObjects.Text;
  private readonly holdBar: Phaser.GameObjects.Rectangle;
  private readonly holdFill: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, registry: WidgetRegistry, viewport: Viewport) {
    registry.register({
      id: WIDGET_ID,
      defaultAnchor: "center",
      defaultOffset: { x: 0, y: 0 },
      defaultScale: 1,
      defaultVisible: true,
    });
    // Registered synchronously above, so this id is always present in the resolved map.
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (!layout) throw new Error("death widget layout was not registered");
    this.container = createWidgetContainer(scene, layout);
    this.vignette = scene.add.rectangle(0, 0, viewport.width, viewport.height, VIGNETTE_COLOR, VIGNETTE_ALPHA);
    this.text = scene.add
      .text(0, 0, deathOverlayText(30), uiTextStyle(20, "#e04a4a", layout.scale, "emphasis"))
      .setOrigin(0.5, 0.5)
      .setAlign("center");
    this.holdBar = scene.add.rectangle(0, 72, HOLD_BAR_WIDTH, HOLD_BAR_HEIGHT, 0x242436)
      .setStrokeStyle(2, 0x77778d);
    this.holdFill = scene.add.rectangle(
      -HOLD_BAR_WIDTH / 2,
      72,
      0,
      HOLD_BAR_HEIGHT - 2,
      0xffd23d,
    ).setOrigin(0, 0.5);
    this.container.add([this.vignette, this.text, this.holdBar, this.holdFill]);
    this.container.setVisible(false);
  }

  update(
    downed: boolean,
    dead: boolean,
    remainingSec: number,
    holdProgress: number,
    downedRemainingSec = 30,
    reviveProgress = 0,
    reviverName: string | null = null,
  ): void {
    this.container.setVisible(downed || dead);
    this.text.setText(downed ? downedOverlayText(downedRemainingSec, reviverName) : deathOverlayText(remainingSec));
    const bar = barPresentation(downed, dead, holdProgress, reviveProgress);
    this.holdBar.setVisible(bar.visible);
    this.holdFill.setVisible(bar.visible)
      .setDisplaySize(HOLD_BAR_WIDTH * Math.min(1, Math.max(0, bar.progress)), HOLD_BAR_HEIGHT - 2);
  }

  /** Resizes the vignette to cover the new viewport, then re-syncs the container position. */
  resize(registry: WidgetRegistry, viewport: Viewport): void {
    this.vignette.setSize(viewport.width, viewport.height);
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (layout) syncWidgetContainer(this.container, layout);
  }
}
