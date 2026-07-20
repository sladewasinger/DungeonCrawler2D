/** Contextual interaction prompt widget ("[R] pick up") — hidden unless a prompt is active. */
import type Phaser from "phaser";
import { uiTextStyle } from "../../font.js";
import { PANEL_BORDER, PANEL_FILL, SELECTION_ACCENT, spacing } from "../../panel.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";

const WIDGET_ID = "interaction";
const PANEL_HEIGHT = 28;

export class InteractionPromptWidget {
  private readonly container: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly keyText: Phaser.GameObjects.Text;
  private readonly labelText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, registry: WidgetRegistry, viewport: Viewport) {
    registry.register({
      id: WIDGET_ID,
      defaultAnchor: "bottom-center",
      defaultOffset: { x: 0, y: -140 },
      defaultScale: 1,
      defaultVisible: true,
    });
    // Registered synchronously above, so this id is always present in the resolved map.
    const layout = registry.resolve(viewport).get(WIDGET_ID)!;
    this.container = createWidgetContainer(scene, layout);
    this.bg = scene.add.graphics();
    const keyColor = `#${SELECTION_ACCENT.toString(16).padStart(6, "0")}`;
    this.keyText = scene.add
      .text(0, PANEL_HEIGHT / 2, "", uiTextStyle(13, keyColor, layout.scale, "emphasis"))
      .setOrigin(0, 0.5);
    this.labelText = scene.add.text(0, PANEL_HEIGHT / 2, "", uiTextStyle(13, undefined, layout.scale)).setOrigin(0, 0.5);
    this.container.add([this.bg, this.keyText, this.labelText]);
    this.container.setVisible(false);
  }

  update(prompt: { key: string; label: string } | null): void {
    if (!prompt) {
      this.container.setVisible(false);
      return;
    }
    this.container.setVisible(true);
    this.keyText.setText(`[${prompt.key}]`);
    this.labelText.setText(` ${prompt.label}`);
    this.layoutTexts();
  }

  private layoutTexts(): void {
    const totalWidth = this.keyText.width + this.labelText.width;
    const startX = -totalWidth / 2;
    this.keyText.setX(startX);
    this.labelText.setX(startX + this.keyText.width);
    this.redrawBackground(totalWidth);
  }

  private redrawBackground(contentWidth: number): void {
    const width = contentWidth + spacing(3);
    this.bg.clear();
    this.bg.fillStyle(PANEL_FILL, 1);
    this.bg.fillRoundedRect(-width / 2, 0, width, PANEL_HEIGHT, 4);
    this.bg.lineStyle(1, PANEL_BORDER, 1);
    this.bg.strokeRoundedRect(-width / 2 + 0.5, 0.5, width - 1, PANEL_HEIGHT - 1, 4);
  }

  /** Re-resolves this widget's screen position for a new viewport (call on resize). */
  resize(registry: WidgetRegistry, viewport: Viewport): void {
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (layout) syncWidgetContainer(this.container, layout);
  }
}
