/**
 * Connection/ping indicator HUD widget: a colored dot (green/gold/red by latency,
 * grey when disconnected) plus the ms readout — reuses the "status" layout slot.
 */
import type Phaser from "phaser";
import { pixelTextStyle } from "../../font.js";
import { spacing } from "../../panel.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";

const WIDGET_ID = "status";
const DOT_RADIUS = 4;
const GOOD_PING_MS = 80;
const OK_PING_MS = 160;
const DISCONNECTED_COLOR = 0x494956;
const GOOD_COLOR = 0x7bd44a;
const OK_COLOR = 0xffd23d;
const BAD_COLOR = 0xe04a4a;

function pingColor(pingMs: number, connected: boolean): number {
  if (!connected) return DISCONNECTED_COLOR;
  if (pingMs <= GOOD_PING_MS) return GOOD_COLOR;
  if (pingMs <= OK_PING_MS) return OK_COLOR;
  return BAD_COLOR;
}

export class ConnectionStatusWidget {
  private readonly container: Phaser.GameObjects.Container;
  private readonly dot: Phaser.GameObjects.Arc;
  private readonly text: Phaser.GameObjects.Text;

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
    this.dot = scene.add.circle(-24, 6, DOT_RADIUS, GOOD_COLOR);
    this.text = scene.add.text(-24 + DOT_RADIUS + spacing(0.75), 0, "", pixelTextStyle(12));
    this.container.add([this.dot, this.text]);
  }

  update(pingMs: number, connected: boolean): void {
    this.dot.setFillStyle(pingColor(pingMs, connected));
    this.text.setText(connected ? `${Math.round(pingMs)}ms` : "offline");
  }

  /** Re-resolves this widget's screen position for a new viewport (call on resize). */
  resize(registry: WidgetRegistry, viewport: Viewport): void {
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (layout) syncWidgetContainer(this.container, layout);
  }
}
