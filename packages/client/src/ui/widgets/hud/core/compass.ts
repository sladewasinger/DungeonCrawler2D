/**
 * LANE W2 HUD compass widget, redesigned as a rotating LETTER DIAL (user correction
 * 2026-07-20): the four cardinals are drawn at their true current screen directions, so
 * whatever letter sits under the fixed top tick IS what renders screen-up right now.
 * The first version was a bare north-needle — mathematically identical information, but
 * a needle pointing right after a Q-press reads as "east is up" when it means "north is
 * to the right (west is up)"; letters remove the ambiguity instead of asking the player
 * to decode it. Animates smoothly through the Z/X lean via rotationControl's bearingDeg().
 *
 * LANE W (panel R3 blocker #2, stairs wayfinding): also carries the gold StairwayDown
 * tick — a small gold arrowhead on the dial at the stairway's live screen bearing
 * (scenes/dungeon/stairwayTick.ts composes it with the same view bearing the letters
 * use, so it tracks rotation by construction), pulsing once the stairway is near.
 * The "COMPASS" caption is gone: it clipped to "COMPAS" at every viewport width
 * (panel R3 small finding) and the lettered dial is self-evident — ASSUMPTION #365.
 */
import type Phaser from "phaser";
import { uiTextStyle } from "../../../foundation/font.js";
import { createWidgetContainer, syncWidgetContainer } from "../../container.js";
import type { WidgetRegistry } from "../../registry.js";
import type { Viewport } from "../../state.js";
import type { StairwayTickData } from "./fakeData.js";
import type { CompassLandmarkTicks } from "./fakeData.js";
import {
  COMPASS_LETTER_RADIUS,
  createCompassPresentation,
} from "./compassPresentation.js";
import {
  syncLandmarkPoint,
  syncStairwayTick,
} from "./compassMarkerPresentation.js";

const WIDGET_ID = "compass";
/** Letters sit just inside the ring so they never collide with the tick. */
const NORTH_COLOR = "#e04a4a"; // blood/damage accent (docs/VISUAL_DIRECTION.md) — N pops
const OTHER_COLOR = "#9a9aae";

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
  /** The gold StairwayDown arrowhead — hidden whenever the floor has no down stairs. */
  private readonly stairwayTick: Phaser.GameObjects.Graphics;
  private readonly safeRoomPoint: Phaser.GameObjects.Graphics;
  private readonly miniBossArenaPoint: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, registry: WidgetRegistry, viewport: Viewport) {
    registry.register({
      id: WIDGET_ID,
      // Offset must clear the dial's own radius (offsets and content both scale with
      // the viewport) — x: -16 left the ring clipped by the screen edge, and y: 272
      // landed on the equipped-item panel.
      defaultAnchor: "top-right",
      defaultOffset: { x: -56, y: 150 },
      defaultScale: 1,
      defaultVisible: true,
    });
    // Registered synchronously above, so this id is always present in the resolved map.
    const layout = registry.resolve(viewport).get(WIDGET_ID)!;
    this.container = createWidgetContainer(scene, layout);
    const presentation = createCompassPresentation(scene);
    this.stairwayTick = presentation.stairway;
    this.safeRoomPoint = presentation.safeRoom;
    this.miniBossArenaPoint = presentation.miniBossArena;
    this.container.add([
      presentation.ring,
      this.stairwayTick,
      this.safeRoomPoint,
      this.miniBossArenaPoint,
    ]);
    this.addCardinalLetters(scene, layout.scale);
    this.update({
      bearingDeg: 0,
      stairway: null,
      landmarks: { safeRoom: null, miniBossArena: null },
      nowMs: 0,
    });
  }

  private addCardinalLetters(scene: Phaser.Scene, scale: number): void {
    for (const cardinal of CARDINALS) {
      const text = scene.add.text(0, 0, cardinal.letter, uiTextStyle(9, cardinal.color, { scale })).setOrigin(0.5, 0.5);
      this.letters.push({ text, offsetDeg: cardinal.offsetDeg });
      this.container.add(text);
    }
  }

  /** `bearingDeg`: 0 = world-north currently renders at screen-up, clockwise-positive
   * (screen east = 90, south = 180, west = 270) — rotationControl.ts's bearingDeg().
   * Each letter is placed AT its cardinal's current screen direction, so the letter
   * under the top tick is always the direction currently rendering screen-up.
   * `stairway` places the gold tick at its own (pre-composed) screen bearing. */
  update(input: CompassUpdate): void {
    const { bearingDeg, stairway, landmarks, nowMs } = input;
    for (const { text, offsetDeg } of this.letters) {
      const rad = ((bearingDeg + offsetDeg) * Math.PI) / 180;
      text.setPosition(
        Math.sin(rad) * COMPASS_LETTER_RADIUS,
        -Math.cos(rad) * COMPASS_LETTER_RADIUS,
      );
    }
    this.stairwayTick.setVisible(stairway !== null);
    if (stairway) syncStairwayTick(this.stairwayTick, stairway, nowMs);
    syncLandmarkPoint(this.safeRoomPoint, landmarks.safeRoom);
    syncLandmarkPoint(this.miniBossArenaPoint, landmarks.miniBossArena);
  }

  /** Re-resolves this widget's screen position for a new viewport (call on resize). */
  resize(registry: WidgetRegistry, viewport: Viewport): void {
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (layout) syncWidgetContainer(this.container, layout);
  }
}

interface CompassUpdate {
  readonly bearingDeg: number;
  readonly stairway: StairwayTickData | null;
  readonly landmarks: CompassLandmarkTicks;
  readonly nowMs: number;
}
