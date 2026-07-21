/**
 * LANE W2 HUD compass widget: a small debug-style dial showing which WORLD direction
 * currently renders at screen-up, animating smoothly through the Q/X rotation tween
 * (scenes/dungeon/rotationControl.ts's bearingDeg()). Placed in the existing top-right
 * indicator stack (status/party/minimap), below the reserved "minimap" slot.
 */
import type Phaser from "phaser";
import { uiTextStyle } from "../../font.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";

const WIDGET_ID = "compass";
const RADIUS = 22;
const RING_COLOR = 0x494956;
const FORWARD_TICK_COLOR = 0x9a9aae;
const NEEDLE_COLOR = 0xe04a4a; // blood/damage accent (docs/VISUAL_DIRECTION.md), used here for the north tip
const LABEL_COLOR = "#9a9aae";

export class CompassWidget {
  private readonly container: Phaser.GameObjects.Container;
  private readonly needle: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, registry: WidgetRegistry, viewport: Viewport) {
    registry.register({
      id: WIDGET_ID,
      // Offset must clear the dial's own radius PLUS the centered "COMPASS" label's
      // half-width (offsets and content both scale with the viewport) — x: -16 left the
      // ring clipped by the screen edge, and y: 272 landed on the equipped-item panel.
      defaultAnchor: "top-right",
      defaultOffset: { x: -56, y: 150 },
      defaultScale: 1,
      defaultVisible: true,
    });
    // Registered synchronously above, so this id is always present in the resolved map.
    const layout = registry.resolve(viewport).get(WIDGET_ID)!;
    this.container = createWidgetContainer(scene, layout);
    const ring = scene.add.graphics();
    ring.lineStyle(2, RING_COLOR, 1);
    ring.strokeCircle(0, 0, RADIUS);
    ring.fillStyle(FORWARD_TICK_COLOR, 1);
    ring.fillTriangle(-4, -RADIUS - 2, 4, -RADIUS - 2, 0, -RADIUS + 6);
    this.needle = scene.add.graphics();
    const label = scene.add.text(0, RADIUS + 12, "COMPASS", uiTextStyle(9, LABEL_COLOR, layout.scale)).setOrigin(0.5, 0.5);
    this.container.add([ring, this.needle, label]);
    this.update(0);
  }

  /** `bearingDeg`: 0 = world-north currently renders at screen-up, clockwise-positive
   * (screen east = 90, south = 180, west = 270) — rotationControl.ts's bearingDeg(). */
  update(bearingDeg: number): void {
    const rad = (bearingDeg * Math.PI) / 180;
    const tip = { x: Math.sin(rad) * (RADIUS - 4), y: -Math.cos(rad) * (RADIUS - 4) };
    const back = { x: Math.sin(rad + Math.PI) * (RADIUS * 0.35), y: -Math.cos(rad + Math.PI) * (RADIUS * 0.35) };
    const left = { x: back.x + Math.sin(rad - Math.PI / 2) * 3, y: back.y - Math.cos(rad - Math.PI / 2) * 3 };
    const right = { x: back.x + Math.sin(rad + Math.PI / 2) * 3, y: back.y - Math.cos(rad + Math.PI / 2) * 3 };
    this.needle.clear();
    this.needle.fillStyle(NEEDLE_COLOR, 1);
    this.needle.fillTriangle(tip.x, tip.y, left.x, left.y, right.x, right.y);
  }

  /** Re-resolves this widget's screen position for a new viewport (call on resize). */
  resize(registry: WidgetRegistry, viewport: Viewport): void {
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (layout) syncWidgetContainer(this.container, layout);
  }
}
