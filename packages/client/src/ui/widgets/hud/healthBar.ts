/**
 * Chunky segmented health bar HUD widget: discrete block segments (not a smooth
 * fill) plus an hp readout, with a white damage-flash pulse when hp drops between updates.
 */
import type Phaser from "phaser";
import { uiTextStyle } from "../../font.js";
import { PANEL_BORDER, PANEL_FILL, spacing } from "../../panel.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";

const WIDGET_ID = "health";
const SEGMENT_COUNT = 8;
const SEGMENT_WIDTH = 20;
const SEGMENT_HEIGHT = 16;
const SEGMENT_GAP = 2;
const FILL_COLOR = 0xe04a4a;
const LOW_HP_COLOR = 0xff9e3d;
const LOW_HP_RATIO = 0.3;
const FLASH_DURATION_MS = 180;

export class HealthBarWidget {
  private readonly container: Phaser.GameObjects.Container;
  private readonly segments: Phaser.GameObjects.Rectangle[] = [];
  private readonly flash: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private previousHp = -1;
  private flashUntilMs = 0;

  constructor(scene: Phaser.Scene, registry: WidgetRegistry, viewport: Viewport) {
    registry.register({
      id: WIDGET_ID,
      defaultAnchor: "top-left",
      defaultOffset: { x: 16, y: 16 },
      defaultScale: 1,
      defaultVisible: true,
    });
    // Registered synchronously above, so this id is always present in the resolved map.
    const layout = registry.resolve(viewport).get(WIDGET_ID)!;
    this.container = createWidgetContainer(scene, layout);

    const totalWidth = SEGMENT_COUNT * SEGMENT_WIDTH + (SEGMENT_COUNT - 1) * SEGMENT_GAP + spacing(1);
    const totalHeight = SEGMENT_HEIGHT + spacing(1);
    const bg = scene.add.rectangle(0, 0, totalWidth, totalHeight, PANEL_FILL).setOrigin(0, 0).setStrokeStyle(1, PANEL_BORDER);
    this.flash = scene.add.rectangle(0, 0, totalWidth, totalHeight, 0xffffff, 0).setOrigin(0, 0);
    this.label = scene.add
      .text(spacing(0.5), totalHeight + spacing(0.2), "", uiTextStyle(12, undefined, layout.scale, "emphasis"))
      .setOrigin(0, 0);
    this.container.add([bg, ...this.buildSegments(scene), this.flash, this.label]);
  }

  private buildSegments(scene: Phaser.Scene): Phaser.GameObjects.Rectangle[] {
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const x = spacing(0.5) + i * (SEGMENT_WIDTH + SEGMENT_GAP);
      const seg = scene.add.rectangle(x, spacing(0.5), SEGMENT_WIDTH, SEGMENT_HEIGHT, FILL_COLOR).setOrigin(0, 0);
      this.segments.push(seg);
    }
    return this.segments;
  }

  update(hp: number, maxHp: number, nowMs: number): void {
    if (this.previousHp >= 0 && hp < this.previousHp) this.flashUntilMs = nowMs + FLASH_DURATION_MS;
    this.previousHp = hp;

    const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    const filledSegments = Math.round(ratio * SEGMENT_COUNT);
    const color = ratio <= LOW_HP_RATIO ? LOW_HP_COLOR : FILL_COLOR;
    this.segments.forEach((seg, i) => seg.setFillStyle(color, i < filledSegments ? 1 : 0.15));
    this.label.setText(`${Math.max(0, Math.round(hp))} / ${maxHp}`);
    this.flash.setAlpha(nowMs < this.flashUntilMs ? 0.5 : 0);
  }

  /** Re-resolves this widget's screen position for a new viewport (call on resize). */
  resize(registry: WidgetRegistry, viewport: Viewport): void {
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (layout) syncWidgetContainer(this.container, layout);
  }
}
