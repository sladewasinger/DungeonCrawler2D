/**
 * Reconnecting toast HUD widget: a small top-center panel that appears only while a
 * previously-live connection is mid dropout/backoff (net/socket.ts retries every 1s
 * until the server answers again) — hidden the rest of the time.
 */
import type Phaser from "phaser";
import { pixelTextStyle } from "../../font.js";
import { drawPanelBackground } from "../../panel.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";

const WIDGET_ID = "reconnect-toast";
const PANEL_WIDTH = 220;
const PANEL_HEIGHT = 32;
const DOT_PERIOD_MS = 1200;

export class ReconnectToastWidget {
  private readonly container: Phaser.GameObjects.Container;
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, registry: WidgetRegistry, viewport: Viewport) {
    registry.register({
      id: WIDGET_ID,
      defaultAnchor: "top-center",
      defaultOffset: { x: 0, y: 48 },
      defaultScale: 1,
      defaultVisible: true,
    });
    // Registered synchronously above, so this id is always present in the resolved map.
    const layout = registry.resolve(viewport).get(WIDGET_ID)!;
    this.container = createWidgetContainer(scene, layout);
    const bg = drawPanelBackground(scene, PANEL_WIDTH, PANEL_HEIGHT).setPosition(-PANEL_WIDTH / 2, 0);
    this.label = scene.add
      .text(0, PANEL_HEIGHT / 2, "", pixelTextStyle(12, "#ffd23d"))
      .setOrigin(0.5, 0.5);
    this.container.add([bg, this.label]);
    this.container.setVisible(false);
  }

  update(reconnecting: boolean, nowMs: number): void {
    this.container.setVisible(reconnecting);
    if (!reconnecting) return;
    const dots = ".".repeat(1 + Math.floor(nowMs / DOT_PERIOD_MS) % 3);
    this.label.setText(`Reconnecting${dots}`);
  }

  /** Re-resolves this widget's screen position for a new viewport (call on resize). */
  resize(registry: WidgetRegistry, viewport: Viewport): void {
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (layout) syncWidgetContainer(this.container, layout);
  }
}
