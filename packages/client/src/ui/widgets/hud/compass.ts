/**
 * LANE W2 HUD compass widget, redesigned as a rotating LETTER DIAL (user correction
 * 2026-07-20): the four cardinals are drawn at their true current screen directions, so
 * whatever letter sits under the fixed top tick IS what renders screen-up right now.
 * The first version was a bare north-needle — mathematically identical information, but
 * a needle pointing right after a Q-press reads as "east is up" when it means "north is
 * to the right (west is up)"; letters remove the ambiguity instead of asking the player
 * to decode it. Animates smoothly through the Q/X lean via rotationControl's bearingDeg().
 */
import type Phaser from "phaser";
import { uiTextStyle } from "../../font.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";

const WIDGET_ID = "compass";
const RADIUS = 22;
/** Letters sit just inside the ring so they never collide with the tick. */
const LETTER_RADIUS = RADIUS - 8;
const RING_COLOR = 0x494956;
const FORWARD_TICK_COLOR = 0x9a9aae;
const NORTH_COLOR = "#e04a4a"; // blood/damage accent (docs/VISUAL_DIRECTION.md) — N pops
const OTHER_COLOR = "#9a9aae";
const LABEL_COLOR = "#9a9aae";

/** Screen-bearing offsets of each cardinal relative to north, clockwise-positive. */
const CARDINALS: ReadonlyArray<{ letter: string; offsetDeg: number; color: string }> = [
  { letter: "N", offsetDeg: 0, color: NORTH_COLOR },
  { letter: "E", offsetDeg: 90, color: OTHER_COLOR },
  { letter: "S", offsetDeg: 180, color: OTHER_COLOR },
  { letter: "W", offsetDeg: 270, color: OTHER_COLOR },
];

export class CompassWidget {
  private readonly container: Phaser.GameObjects.Container;
  private readonly letters: Array<{ readonly text: Phaser.GameObjects.Text; readonly offsetDeg: number }> = [];

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
    const label = scene.add.text(0, RADIUS + 12, "COMPASS", uiTextStyle(9, LABEL_COLOR, layout.scale)).setOrigin(0.5, 0.5);
    this.container.add([ring, label]);
    for (const cardinal of CARDINALS) {
      const text = scene.add.text(0, 0, cardinal.letter, uiTextStyle(9, cardinal.color, layout.scale)).setOrigin(0.5, 0.5);
      this.letters.push({ text, offsetDeg: cardinal.offsetDeg });
      this.container.add(text);
    }
    this.update(0);
  }

  /** `bearingDeg`: 0 = world-north currently renders at screen-up, clockwise-positive
   * (screen east = 90, south = 180, west = 270) — rotationControl.ts's bearingDeg().
   * Each letter is placed AT its cardinal's current screen direction, so the letter
   * under the top tick is always the direction currently rendering screen-up. */
  update(bearingDeg: number): void {
    for (const { text, offsetDeg } of this.letters) {
      const rad = ((bearingDeg + offsetDeg) * Math.PI) / 180;
      text.setPosition(Math.sin(rad) * LETTER_RADIUS, -Math.cos(rad) * LETTER_RADIUS);
    }
  }

  /** Re-resolves this widget's screen position for a new viewport (call on resize). */
  resize(registry: WidgetRegistry, viewport: Viewport): void {
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (layout) syncWidgetContainer(this.container, layout);
  }
}
