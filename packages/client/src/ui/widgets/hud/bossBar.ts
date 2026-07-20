/**
 * Boss HP bar HUD widget: name + a wide smooth-fill bar, pinned top-center — visible
 * only while a boss entity (bossBarView.ts) is in the player's AOI. Registered like
 * any other widget (hudScale aware, movable via the HUD editor).
 */
import type Phaser from "phaser";
import { uiTextStyle } from "../../font.js";
import { PANEL_BORDER, PANEL_FILL, spacing } from "../../panel.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";
import type { BossBarData } from "./bossBarView.js";

const WIDGET_ID = "bossBar";
const BAR_WIDTH = 320;
const BAR_HEIGHT = 14;
const FILL_COLOR = 0x9c1c2e;

export class BossBarWidget {
  private readonly container: Phaser.GameObjects.Container;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly nameLabel: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, registry: WidgetRegistry, viewport: Viewport) {
    registry.register({
      id: WIDGET_ID,
      defaultAnchor: "top-center",
      defaultOffset: { x: 0, y: 16 },
      defaultScale: 1,
      defaultVisible: true,
    });
    // Registered synchronously above, so this id is always present in the resolved map.
    const layout = registry.resolve(viewport).get(WIDGET_ID)!;
    this.container = createWidgetContainer(scene, layout);
    this.nameLabel = scene.add
      .text(0, -spacing(0.5), "", uiTextStyle(13, "#e8e8e8", layout.scale, "emphasis"))
      .setOrigin(0.5, 1);
    const bg = scene.add
      .rectangle(-BAR_WIDTH / 2, 0, BAR_WIDTH, BAR_HEIGHT, PANEL_FILL)
      .setOrigin(0, 0)
      .setStrokeStyle(1, PANEL_BORDER);
    this.fill = scene.add.rectangle(-BAR_WIDTH / 2, 0, BAR_WIDTH, BAR_HEIGHT, FILL_COLOR).setOrigin(0, 0);
    this.container.add([this.nameLabel, bg, this.fill]);
    this.container.setVisible(false);
  }

  update(boss: BossBarData | null): void {
    this.container.setVisible(boss !== null);
    if (!boss) return;
    const ratio = boss.maxHp > 0 ? Math.max(0, Math.min(1, boss.hp / boss.maxHp)) : 0;
    this.fill.width = BAR_WIDTH * ratio;
    this.nameLabel.setText(boss.name);
  }

  /** Re-resolves this widget's screen position for a new viewport (call on resize). */
  resize(registry: WidgetRegistry, viewport: Viewport): void {
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (layout) syncWidgetContainer(this.container, layout);
  }
}
