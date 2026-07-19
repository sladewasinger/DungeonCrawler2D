/**
 * Buff/debuff chip row HUD widget: one square icon chip per active status, ringed in
 * its palette accent, with a duration pip (a shrinking bottom bar — the pack has no
 * clock/hourglass sprite to autotile from).
 */
import type Phaser from "phaser";
import { pixelTextStyle } from "../../font.js";
import { PANEL_BORDER, spacing } from "../../panel.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";
import type { BuffChipData } from "./fakeData.js";

const WIDGET_ID = "buffs";
const CHIP_SIZE = 24;
const CHIP_GAP = 4;
const MAX_CHIPS = 6;
const PIP_HEIGHT = 3;
const DEBUFF_COLOR = 0xe04a4a;
const BUFF_COLOR = 0x3dd6c3;

/** Palette accent per status id (falls back to the generic buff/debuff color from VISUAL_DIRECTION.md). */
const STATUS_COLORS: Readonly<Record<string, number>> = {
  "on-fire": 0xff9e3d,
  poisoned: 0x7bd44a,
  bleeding: DEBUFF_COLOR,
  wet: BUFF_COLOR,
};

function statusColor(statusId: string, kind: "buff" | "debuff"): number {
  return STATUS_COLORS[statusId] ?? (kind === "buff" ? BUFF_COLOR : DEBUFF_COLOR);
}

function colorHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

interface ChipVisual {
  container: Phaser.GameObjects.Container;
  box: Phaser.GameObjects.Rectangle;
  letter: Phaser.GameObjects.Text;
  pip: Phaser.GameObjects.Rectangle;
}

export class BuffChipsWidget {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly chips: ChipVisual[] = [];

  constructor(scene: Phaser.Scene, registry: WidgetRegistry, viewport: Viewport) {
    this.scene = scene;
    registry.register({
      id: WIDGET_ID,
      defaultAnchor: "top-left",
      defaultOffset: { x: 16, y: 64 },
      defaultScale: 1,
      defaultVisible: true,
    });
    // Registered synchronously above, so this id is always present in the resolved map.
    const layout = registry.resolve(viewport).get(WIDGET_ID)!;
    this.root = createWidgetContainer(scene, layout);
    for (let i = 0; i < MAX_CHIPS; i++) this.chips.push(this.buildChip(i));
  }

  private buildChip(index: number): ChipVisual {
    const x = index * (CHIP_SIZE + CHIP_GAP);
    const box = this.scene.add.rectangle(x, 0, CHIP_SIZE, CHIP_SIZE, 0x1a1a24).setOrigin(0, 0).setStrokeStyle(1, PANEL_BORDER);
    const letter = this.scene.add.text(x + CHIP_SIZE / 2, CHIP_SIZE / 2 - spacing(0.3), "", pixelTextStyle(12)).setOrigin(0.5, 0.5);
    const pip = this.scene.add.rectangle(x, CHIP_SIZE - PIP_HEIGHT, CHIP_SIZE, PIP_HEIGHT, 0xffffff).setOrigin(0, 0);
    const container = this.scene.add.container(0, 0, [box, letter, pip]).setVisible(false);
    this.root.add(container);
    return { container, box, letter, pip };
  }

  update(buffs: BuffChipData[]): void {
    this.chips.forEach((chip, i) => this.applyChip(chip, buffs[i]));
  }

  private applyChip(chip: ChipVisual, data: BuffChipData | undefined): void {
    chip.container.setVisible(!!data);
    if (!data) return;
    const color = statusColor(data.statusId, data.kind);
    chip.box.setStrokeStyle(1, color);
    chip.letter.setText(data.statusId.charAt(0).toUpperCase()).setColor(colorHex(color));
    const ratio = data.durationSec > 0 ? Math.max(0, Math.min(1, data.remainingSec / data.durationSec)) : 0;
    chip.pip.width = CHIP_SIZE * ratio;
    chip.pip.setFillStyle(color, 1);
  }

  /** Re-resolves this widget's screen position for a new viewport (call on resize). */
  resize(registry: WidgetRegistry, viewport: Viewport): void {
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (layout) syncWidgetContainer(this.root, layout);
  }
}
