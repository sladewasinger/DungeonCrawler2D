/**
 * Top-right indicator stack HUD widget: ping (colorized by latency), a
 * ~30-frame-smoothed FPS readout (colorized by framerate), and the player's
 * rounded predicted tile coordinates ("so users can find each other or share
 * positions") — one widget under one anchor, so the stack re-anchors as a unit.
 * Reuses the "status" layout slot (formerly ping-only, top-center). Renders as
 * bare right-aligned text with no panel chip behind it (user-decreed
 * 2026-07-19, docs/ROADMAP.md Epic 7.7 — legibility comes from the readable
 * UI font, not a background).
 */
import type Phaser from "phaser";
import { uiTextStyle } from "../../font.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";
import type { TileCoords } from "./fakeData.js";

const WIDGET_ID = "status";
const ROW_HEIGHT = 18;
const ROW_TEXT_SIZE = 12;
/** Right-aligned rows sit flush with the widget's anchor point (local x=0). */
const TEXT_X = 0;

const GOOD_PING_MS = 80;
const OK_PING_MS = 150;
const GOOD_FPS = 55;
const OK_FPS = 30;
/** ~30 rendered frames of game.loop.actualFps — smooths the readout past single-frame jitter. */
const FPS_SMOOTH_FRAMES = 30;

const DISCONNECTED_COLOR = 0x494956;
const GOOD_COLOR = 0x3dd6c3; // sanctuary/portal teal (docs/VISUAL_DIRECTION.md palette)
const OK_COLOR = 0xffd23d; // loot/gold
const BAD_COLOR = 0xe04a4a; // blood/damage
const NEUTRAL_TEXT_COLOR = "#e8e8e8";

function colorHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function pingColor(pingMs: number, connected: boolean): number {
  if (!connected) return DISCONNECTED_COLOR;
  if (pingMs < GOOD_PING_MS) return GOOD_COLOR;
  if (pingMs < OK_PING_MS) return OK_COLOR;
  return BAD_COLOR;
}

function fpsColor(fps: number): number {
  if (fps >= GOOD_FPS) return GOOD_COLOR;
  if (fps >= OK_FPS) return OK_COLOR;
  return BAD_COLOR;
}

function rowY(index: number): number {
  return ROW_HEIGHT * index + ROW_HEIGHT / 2;
}

export class ConnectionStatusWidget {
  private readonly container: Phaser.GameObjects.Container;
  private readonly pingText: Phaser.GameObjects.Text;
  private readonly fpsText: Phaser.GameObjects.Text;
  private readonly coordsText: Phaser.GameObjects.Text;
  private readonly fpsSamples: number[] = [];

  constructor(scene: Phaser.Scene, registry: WidgetRegistry, viewport: Viewport) {
    registry.register({
      id: WIDGET_ID,
      defaultAnchor: "top-right",
      defaultOffset: { x: -16, y: 16 },
      defaultScale: 1,
      defaultVisible: true,
    });
    // Registered synchronously above, so this id is always present in the resolved map.
    const layout = registry.resolve(viewport).get(WIDGET_ID)!;
    this.container = createWidgetContainer(scene, layout);
    this.pingText = this.buildRow(scene, 0);
    this.fpsText = this.buildRow(scene, 1);
    this.coordsText = this.buildRow(scene, 2);
    this.container.add([this.pingText, this.fpsText, this.coordsText]);
  }

  private buildRow(scene: Phaser.Scene, index: number): Phaser.GameObjects.Text {
    return scene.add.text(TEXT_X, rowY(index), "", uiTextStyle(ROW_TEXT_SIZE)).setOrigin(1, 0.5);
  }

  update(pingMs: number, connected: boolean, fpsSample: number, coords: TileCoords): void {
    const ping = pingColor(pingMs, connected);
    this.pingText.setText(connected ? `${Math.round(pingMs)}ms` : "offline").setColor(colorHex(ping));

    const fps = this.smoothedFps(fpsSample);
    this.fpsText.setText(`${fps}fps`).setColor(colorHex(fpsColor(fps)));

    this.coordsText.setText(`x ${coords.x}, y ${coords.y}`).setColor(NEUTRAL_TEXT_COLOR);
  }

  /** Rolling average over the last FPS_SMOOTH_FRAMES samples — actualFps alone jitters frame to frame. */
  private smoothedFps(sample: number): number {
    this.fpsSamples.push(sample);
    if (this.fpsSamples.length > FPS_SMOOTH_FRAMES) this.fpsSamples.shift();
    const total = this.fpsSamples.reduce((sum, value) => sum + value, 0);
    return Math.round(total / this.fpsSamples.length);
  }

  /** Re-resolves this widget's screen position for a new viewport (call on resize). */
  resize(registry: WidgetRegistry, viewport: Viewport): void {
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (layout) syncWidgetContainer(this.container, layout);
  }
}
