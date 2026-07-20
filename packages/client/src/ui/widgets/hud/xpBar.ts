/**
 * Thin XP progress bar + level numeral HUD widget (Epic 11 core, pulled forward) —
 * GRINDER/TOURIST's "where is my character level?" demand. A slim smooth-fill bar
 * (not chunky-segmented like healthBar.ts — xp is a continuous trickle, not discrete
 * hits) with a "Lv N" badge docked to its left.
 */
import type Phaser from "phaser";
import { uiTextStyle } from "../../font.js";
import { PANEL_BORDER, PANEL_FILL, spacing } from "../../panel.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";
import { xpProgressRatio, type XpBarData } from "./xpBarView.js";

const WIDGET_ID = "xp";
const BAR_WIDTH = 168;
const BAR_HEIGHT = 6;
const FILL_COLOR = 0xffd23d;
const LEVEL_BADGE_WIDTH = 34;

export class XpBarWidget {
  private readonly container: Phaser.GameObjects.Container;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly levelLabel: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, registry: WidgetRegistry, viewport: Viewport) {
    registry.register({
      id: WIDGET_ID,
      defaultAnchor: "top-left",
      defaultOffset: { x: 16, y: 52 },
      defaultScale: 1,
      defaultVisible: true,
    });
    // Registered synchronously above, so this id is always present in the resolved map.
    const layout = registry.resolve(viewport).get(WIDGET_ID)!;
    this.container = createWidgetContainer(scene, layout);

    const badgeX = 0;
    this.levelLabel = scene.add
      .text(badgeX + LEVEL_BADGE_WIDTH / 2, BAR_HEIGHT / 2 + spacing(0.5), "Lv 1", uiTextStyle(11, undefined, layout.scale, "emphasis"))
      .setOrigin(0.5, 0.5);

    const barX = LEVEL_BADGE_WIDTH + spacing(1);
    const bg = scene.add
      .rectangle(barX, 0, BAR_WIDTH, BAR_HEIGHT, PANEL_FILL)
      .setOrigin(0, 0)
      .setStrokeStyle(1, PANEL_BORDER);
    this.fill = scene.add.rectangle(barX, 0, BAR_WIDTH, BAR_HEIGHT, FILL_COLOR).setOrigin(0, 0);
    this.container.add([this.levelLabel, bg, this.fill]);
  }

  update(data: XpBarData): void {
    this.fill.width = BAR_WIDTH * xpProgressRatio(data);
    this.levelLabel.setText(`Lv ${data.level}`);
  }

  /** Re-resolves this widget's screen position for a new viewport (call on resize). */
  resize(registry: WidgetRegistry, viewport: Viewport): void {
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (layout) syncWidgetContainer(this.container, layout);
  }
}
