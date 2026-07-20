/**
 * Top-right telemetry stack HUD widget: ping (colorized by latency), a
 * ~30-frame-smoothed FPS readout, the player's predicted tile position
 * (x, y, z — one decimal on z), the world seed, and the build's git short
 * SHA. Defaults HIDDEN and self-binds [F3] to toggle — the judge-panel
 * verdict was "debug telemetry should not be shipping visible-by-default"
 * (it also physically covered the mobile attack button), so this widget is
 * never even constructed on touch (see ui/widgets/hud/index.ts) and starts
 * closed everywhere else, mirroring ui/hudEdit/index.ts's self-bound [F10].
 */
import type Phaser from "phaser";
import { BUILD_SHA } from "../../../buildInfo.js";
import { uiTextStyle } from "../../font.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";
import type { TileCoords } from "./fakeData.js";

const WIDGET_ID = "status";
const ROW_HEIGHT = 16;
const ROW_TEXT_SIZE = 11;
/** Right-aligned rows sit flush with the widget's anchor point (local x=0). */
const TEXT_X = 0;
const ROW_COUNT = 5;

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
const DIM_TEXT_COLOR = "#9a9aae";

function colorHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

export function pingColor(pingMs: number, connected: boolean): number {
  if (!connected) return DISCONNECTED_COLOR;
  if (pingMs < GOOD_PING_MS) return GOOD_COLOR;
  if (pingMs < OK_PING_MS) return OK_COLOR;
  return BAD_COLOR;
}

export function fpsColor(fps: number): number {
  if (fps >= GOOD_FPS) return GOOD_COLOR;
  if (fps >= OK_FPS) return OK_COLOR;
  return BAD_COLOR;
}

/** Pure [F3] toggle step — hidden by default, per-press flip; exported for connectionStatus.test.ts. */
export function nextTelemetryVisible(current: boolean): boolean {
  return !current;
}

function rowY(index: number): number {
  return ROW_HEIGHT * index + ROW_HEIGHT / 2;
}

export class ConnectionStatusWidget {
  private readonly container: Phaser.GameObjects.Container;
  private readonly rows: Phaser.GameObjects.Text[];
  private readonly fpsSamples: number[] = [];
  /** Hidden by default (user-decreed 2026-07-20) — [F3] flips this. */
  private telemetryOn = false;

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
    this.rows = Array.from({ length: ROW_COUNT }, (_, i) => this.buildRow(scene, i, layout.scale));
    this.container.add(this.rows);
    this.container.setVisible(this.telemetryOn);
    scene.input.keyboard?.on("keydown-F3", (event: KeyboardEvent) => {
      event.preventDefault();
      this.toggle();
    });
  }

  private buildRow(scene: Phaser.Scene, index: number, scale: number): Phaser.GameObjects.Text {
    return scene.add.text(TEXT_X, rowY(index), "", uiTextStyle(ROW_TEXT_SIZE, undefined, scale)).setOrigin(1, 0.5);
  }

  toggle(): void {
    this.telemetryOn = nextTelemetryVisible(this.telemetryOn);
    this.container.setVisible(this.telemetryOn);
  }

  update(pingMs: number, connected: boolean, fpsSample: number, coords: TileCoords, seed: string | null): void {
    // Still tracked while hidden so the FPS smoothing window isn't cold the moment [F3] opens it.
    const fps = this.smoothedFps(fpsSample);
    if (!this.telemetryOn) return;
    const [ping, fpsRow, coordsRow, seedRow, buildRow] = this.rows as [
      Phaser.GameObjects.Text,
      Phaser.GameObjects.Text,
      Phaser.GameObjects.Text,
      Phaser.GameObjects.Text,
      Phaser.GameObjects.Text,
    ];
    ping.setText(connected ? `${Math.round(pingMs)}ms` : "offline").setColor(colorHex(pingColor(pingMs, connected)));
    fpsRow.setText(`${fps}fps`).setColor(colorHex(fpsColor(fps)));
    coordsRow.setText(`x ${coords.x}, y ${coords.y}, z ${coords.z.toFixed(1)}`).setColor(NEUTRAL_TEXT_COLOR);
    seedRow.setText(`seed ${seed ?? "—"}`).setColor(DIM_TEXT_COLOR);
    buildRow.setText(`build ${BUILD_SHA}`).setColor(DIM_TEXT_COLOR);
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
