/**
 * Party frames HUD widget: one compact row per off-self party member — name, a thin
 * hp bar, and a red DOWNED tag — so a teammate's status reads at a glance even off-AOI
 * (Epic 7.12; partySnapshotSchema's hp/downed fields exist for exactly this). The
 * whole widget hides when unpartied.
 */
import type Phaser from "phaser";
import { uiTextStyle } from "../../font.js";
import { PANEL_BORDER, PANEL_FILL, spacing } from "../../panel.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";

export interface PartyRowData {
  readonly id: string;
  readonly name: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly downed: boolean;
}

const WIDGET_ID = "party";
/** Beyond this, a member simply has no dedicated row — party size itself is
 * unbounded (docs/ASSUMPTIONS.md #67), but HUD real estate isn't. */
const MAX_ROWS = 6;
const ROW_WIDTH = 150;
const ROW_HEIGHT = 22;
const ROW_GAP = 4;
const HP_BAR_WIDTH = 70;
const HP_BAR_HEIGHT = 5;
const HP_COLOR = 0x3dd6c3;
const DOWNED_COLOR = 0xe04a4a;

interface RowVisual {
  container: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  hpFill: Phaser.GameObjects.Rectangle;
  downedTag: Phaser.GameObjects.Text;
}

export class PartyFramesWidget {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly rows: RowVisual[] = [];

  constructor(scene: Phaser.Scene, registry: WidgetRegistry, viewport: Viewport) {
    this.scene = scene;
    registry.register({
      id: WIDGET_ID,
      defaultAnchor: "top-left",
      defaultOffset: { x: 16, y: 108 },
      defaultScale: 1,
      defaultVisible: true,
    });
    // Registered synchronously above, so this id is always present in the resolved map.
    const layout = registry.resolve(viewport).get(WIDGET_ID)!;
    this.root = createWidgetContainer(scene, layout);
    for (let i = 0; i < MAX_ROWS; i++) this.rows.push(this.buildRow(i));
  }

  private buildRow(index: number): RowVisual {
    const y = index * (ROW_HEIGHT + ROW_GAP);
    const bg = this.scene.add
      .rectangle(0, y, ROW_WIDTH, ROW_HEIGHT, PANEL_FILL, 0.85)
      .setOrigin(0, 0)
      .setStrokeStyle(1, PANEL_BORDER);
    const label = this.scene.add.text(spacing(0.5), y + 2, "", uiTextStyle(10)).setOrigin(0, 0);
    const barY = y + ROW_HEIGHT - HP_BAR_HEIGHT - 3;
    const hpBg = this.scene.add.rectangle(spacing(0.5), barY, HP_BAR_WIDTH, HP_BAR_HEIGHT, 0x1a1a24).setOrigin(0, 0);
    const hpFill = this.scene.add.rectangle(spacing(0.5), barY, HP_BAR_WIDTH, HP_BAR_HEIGHT, HP_COLOR).setOrigin(0, 0);
    const downedTag = this.scene.add
      .text(ROW_WIDTH - spacing(0.5), y + 2, "DOWNED", uiTextStyle(9, "#e04a4a"))
      .setOrigin(1, 0);
    const container = this.scene.add.container(0, 0, [bg, label, hpBg, hpFill, downedTag]).setVisible(false);
    this.root.add(container);
    return { container, label, hpFill, downedTag };
  }

  update(members: readonly PartyRowData[]): void {
    this.root.setVisible(members.length > 0);
    this.rows.forEach((row, i) => this.applyRow(row, members[i]));
  }

  private applyRow(row: RowVisual, data: PartyRowData | undefined): void {
    row.container.setVisible(!!data);
    if (!data) return;
    row.label.setText(data.name);
    const ratio = data.maxHp > 0 ? Math.max(0, Math.min(1, data.hp / data.maxHp)) : 0;
    row.hpFill.width = HP_BAR_WIDTH * ratio;
    row.hpFill.setFillStyle(data.downed ? DOWNED_COLOR : HP_COLOR);
    row.downedTag.setVisible(data.downed);
  }

  /** Re-resolves this widget's screen position for a new viewport (call on resize). */
  resize(registry: WidgetRegistry, viewport: Viewport): void {
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (layout) syncWidgetContainer(this.root, layout);
  }
}
