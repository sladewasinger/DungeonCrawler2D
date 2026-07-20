/**
 * Edit-HUD's catalog side panel: docked to the right screen edge, lists every
 * *registered* widget (hidden ones included — docs/HUD_OS.md §3 "window store") with
 * a click-to-toggle visibility row, plus Save/Reset controls for the whole layout.
 * Not itself a registry window; only ever rendered while edit-HUD mode is active.
 * Rebuilds its full row list on refresh() (mirrors inventoryWindow.ts's rebuildRows
 * pattern) rather than diffing — the catalog is small and only changes on user action.
 */
import type Phaser from "phaser";
import { uiTextStyle } from "../font.js";
import { drawPanelBackground, PANEL_BORDER, PANEL_FILL, spacing } from "../panel.js";
import type { WidgetDefinition, WidgetOverride } from "../widgets/state.js";
import { buildCatalogRows } from "./catalog.js";

const PANEL_WIDTH = 208;
export const PANEL_RIGHT_INSET = 12;
export const PANEL_TOP_INSET = 90;
const HEADER_HEIGHT = 24;
const BUTTON_HEIGHT = 24;
const ROW_HEIGHT = 22;
/** No scroll region — matches Phase 1 inventory's own deferral (HUD_OS.md §7);
 * the shipped widget count comfortably fits without one. */
const MAX_VISIBLE_ROWS = 20;

export interface CatalogActions {
  onToggleVisible(id: string): void;
  onSave(): void;
  onReset(): void;
}

export class CatalogPanel {
  readonly container: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private readonly listDefinitions: () => WidgetDefinition[];
  private readonly overrideFor: (id: string) => WidgetOverride | undefined;
  private readonly actions: CatalogActions;

  constructor(
    scene: Phaser.Scene,
    depth: number,
    listDefinitions: () => WidgetDefinition[],
    overrideFor: (id: string) => WidgetOverride | undefined,
    actions: CatalogActions,
  ) {
    this.scene = scene;
    this.listDefinitions = listDefinitions;
    this.overrideFor = overrideFor;
    this.actions = actions;
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(depth);
  }

  reposition(viewport: { width: number; height: number }): void {
    this.container.setPosition(viewport.width - PANEL_RIGHT_INSET - PANEL_WIDTH, PANEL_TOP_INSET);
  }

  /** Rebuilds the entire panel from the registry's current state — call on enter, save, reset, or any visibility toggle. */
  refresh(): void {
    this.container.removeAll(true);
    const rows = buildCatalogRows(this.listDefinitions(), this.overrideFor).slice(0, MAX_VISIBLE_ROWS);
    const height = HEADER_HEIGHT + BUTTON_HEIGHT + spacing(1) + rows.length * ROW_HEIGHT + spacing(1);
    this.container.add(drawPanelBackground(this.scene, PANEL_WIDTH, height).setAlpha(0.95));
    this.container.add(this.scene.add.text(spacing(1), spacing(1), "EDIT HUD", uiTextStyle(12, "#ffd23d")).setOrigin(0, 0));
    this.buildButtons();
    rows.forEach((row, index) => this.buildRow(row.id, row.visible, HEADER_HEIGHT + BUTTON_HEIGHT + spacing(1) + index * ROW_HEIGHT));
  }

  private buildButtons(): void {
    const width = (PANEL_WIDTH - spacing(3)) / 2;
    this.buildButton(spacing(1), HEADER_HEIGHT, width, "Save", () => this.actions.onSave());
    this.buildButton(spacing(1) * 2 + width, HEADER_HEIGHT, width, "Reset", () => this.actions.onReset());
  }

  private buildButton(x: number, y: number, width: number, label: string, onClick: () => void): void {
    const bg = this.scene.add
      .rectangle(x, y, width, BUTTON_HEIGHT - 4, PANEL_FILL, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(1, PANEL_BORDER)
      .setInteractive({ useHandCursor: true });
    bg.on("pointerdown", onClick);
    const text = this.scene.add.text(x + width / 2, y + (BUTTON_HEIGHT - 4) / 2, label, uiTextStyle(11)).setOrigin(0.5, 0.5);
    this.container.add([bg, text]);
  }

  private buildRow(id: string, visible: boolean, y: number): void {
    const rowBg = this.scene.add
      .rectangle(spacing(1), y, PANEL_WIDTH - spacing(2), ROW_HEIGHT - 2, PANEL_FILL, 0.4)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    rowBg.on("pointerdown", () => this.actions.onToggleVisible(id));
    const boxSize = 12;
    const boxY = y + (ROW_HEIGHT - 2 - boxSize) / 2;
    const checkbox = this.scene.add
      .rectangle(spacing(1) + 4, boxY, boxSize, boxSize, visible ? 0xffd23d : PANEL_FILL, visible ? 1 : 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(1, PANEL_BORDER);
    const label = this.scene.add
      .text(spacing(1) + 4 + boxSize + spacing(0.75), y + (ROW_HEIGHT - 2) / 2, id, uiTextStyle(11, visible ? "#e8e8e8" : "#6b6b7e"))
      .setOrigin(0, 0.5);
    this.container.add([rowBg, checkbox, label]);
  }
}
