/**
 * Stash window HUD widget (Epic 7.12): registry id "stash" — a fixed centered panel with
 * two columns (your Inventory | the Stash), each row a Put/Take button over the existing
 * `clientStashSchema` put/take-by-index intent (net/connection.ts's stashOp). Opens via
 * [E] near a stash station (matching v1's "interact both reveals and opens" flow) and
 * auto-closes the moment the snapshot reports the station's no longer nearby. Mirrors
 * inventoryWindow.ts's Phase 1 pattern: real interactive Phaser objects, not routed
 * through HudWidgets.hitTest()'s string-tag dispatch.
 */
import type Phaser from "phaser";
import { uiTextStyle } from "../../font.js";
import { drawPanelBackground, PANEL_BORDER, PANEL_FILL, spacing } from "../../panel.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";
import type { StashSnapshot, ToastData } from "./fakeData.js";
import { createItemIcon } from "./itemIcon.js";
import type { StashRowView } from "./stashRows.js";

const WIDGET_ID = "stash";
const PANEL_WIDTH = 440;
const PANEL_HEIGHT = 300;
const TITLE_HEIGHT = 24;
const ROW_HEIGHT = 28;
const ICON_SIZE = 20;
const BTN_WIDTH = 44;
const BTN_HEIGHT = 18;
const COLUMN_WIDTH = (PANEL_WIDTH - spacing(3)) / 2;
const MAX_VISIBLE_ROWS = Math.floor((PANEL_HEIGHT - TITLE_HEIGHT - spacing(3)) / ROW_HEIGHT);

/** The stash intents this window drives — both index-addressed, matching game-server's doStash. */
export interface StashActions {
  put(index: number): void;
  take(index: number): void;
}

/** One column's static chrome: x origin, title, button label/handler. */
interface ColumnSpec {
  x: number;
  title: string;
  buttonLabel: string;
  onClick: (index: number) => void;
}

export class StashWindowWidget {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Container;
  private readonly hitArea: Phaser.GameObjects.Rectangle;
  private readonly footer: Phaser.GameObjects.Text;
  private readonly actions: StashActions;
  private rowObjects: Phaser.GameObjects.GameObject[] = [];
  private open = false;
  private lastSignature: string | null = null;

  constructor(scene: Phaser.Scene, registry: WidgetRegistry, viewport: Viewport, actions: StashActions) {
    this.scene = scene;
    this.actions = actions;
    registry.register({ id: WIDGET_ID, defaultAnchor: "center", defaultOffset: { x: 0, y: 0 }, defaultScale: 1, defaultVisible: true });
    // Registered synchronously above, so this id is always present in the resolved map.
    const layout = registry.resolve(viewport).get(WIDGET_ID)!;
    this.container = createWidgetContainer(scene, layout);
    this.panel = scene.add.container(0, 0);
    this.container.add(this.panel);
    const bg = drawPanelBackground(scene, PANEL_WIDTH, PANEL_HEIGHT).setPosition(-PANEL_WIDTH / 2, -PANEL_HEIGHT / 2);
    this.hitArea = scene.add
      .rectangle(-PANEL_WIDTH / 2, -PANEL_HEIGHT / 2, PANEL_WIDTH, PANEL_HEIGHT, 0x000000, 0)
      .setOrigin(0, 0);
    this.footer = scene.add
      .text(0, PANEL_HEIGHT / 2 - spacing(1.5), "", uiTextStyle(10, "#c8ecf7"))
      .setOrigin(0.5, 1);
    this.panel.add([bg, this.hitArea, this.footer]);
    this.buildColumnTitles();
    this.panel.setVisible(false);
  }

  /** Fixed 2-tuple (not ColumnSpec[]) so callers can destructure without a non-null assertion. */
  private columns(): [ColumnSpec, ColumnSpec] {
    const left = -PANEL_WIDTH / 2 + spacing(1);
    const right = spacing(0.5);
    return [
      { x: left, title: "INVENTORY", buttonLabel: "Put", onClick: (i) => this.actions.put(i) },
      { x: right, title: "STASH", buttonLabel: "Take", onClick: (i) => this.actions.take(i) },
    ];
  }

  private buildColumnTitles(): void {
    const y = -PANEL_HEIGHT / 2 + TITLE_HEIGHT / 2;
    for (const column of this.columns()) {
      const label = this.scene.add.text(column.x + COLUMN_WIDTH / 2, y, column.title, uiTextStyle(11)).setOrigin(0.5, 0.5);
      this.panel.add(label);
    }
  }

  private rebuildRows(stash: StashSnapshot): void {
    for (const obj of this.rowObjects) obj.destroy();
    this.rowObjects = [];
    const [inventoryColumn, stashColumn] = this.columns();
    this.rebuildColumn(inventoryColumn, stash.inventory);
    this.rebuildColumn(stashColumn, stash.entries);
  }

  private rebuildColumn(column: ColumnSpec, rows: readonly StashRowView[]): void {
    const top = -PANEL_HEIGHT / 2 + TITLE_HEIGHT + spacing(1);
    rows.slice(0, MAX_VISIBLE_ROWS).forEach((view, i) => {
      this.rowObjects.push(...this.buildRow(column, view, top + i * ROW_HEIGHT));
    });
  }

  private buildRow(column: ColumnSpec, view: StashRowView, y: number): Phaser.GameObjects.GameObject[] {
    const left = column.x;
    const rowBg = this.scene.add.rectangle(left, y, COLUMN_WIDTH, ROW_HEIGHT - 2, PANEL_FILL, 0.4).setOrigin(0, 0);
    const icon = createItemIcon(this.scene, view.itemId, ICON_SIZE).setPosition(left + ICON_SIZE / 2 + 4, y + (ROW_HEIGHT - 2) / 2);
    const btnX = left + COLUMN_WIDTH - BTN_WIDTH;
    const name = this.scene.add
      .text(left + ICON_SIZE + spacing(1), y + (ROW_HEIGHT - 2) / 2, `${view.name} ×${view.qty}`, uiTextStyle(10))
      .setOrigin(0, 0.5)
      .setFixedSize(btnX - (left + ICON_SIZE + spacing(1)) - 4, 0);
    const button = this.buildButton(column, view.index, btnX, y + (ROW_HEIGHT - 2 - BTN_HEIGHT) / 2);
    const objects = [rowBg, icon, name, ...button];
    this.panel.add(objects);
    return objects;
  }

  private buildButton(column: ColumnSpec, index: number, x: number, y: number): Phaser.GameObjects.GameObject[] {
    const bg = this.scene.add
      .rectangle(x, y, BTN_WIDTH, BTN_HEIGHT, PANEL_FILL, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(1, PANEL_BORDER)
      .setInteractive({ useHandCursor: true });
    bg.on("pointerdown", () => column.onClick(index));
    const text = this.scene.add.text(x + BTN_WIDTH / 2, y + BTN_HEIGHT / 2, column.buttonLabel, uiTextStyle(9)).setOrigin(0.5, 0.5);
    return [bg, text];
  }

  /** Rebuilds rows on signature change; auto-closes the moment the stash falls out of range. */
  update(stash: StashSnapshot, lastToast: ToastData | null, nowMs: number): void {
    if (!this.open) return;
    if (!stash.nearby) {
      this.close();
      return;
    }
    const toastText = lastToast && lastToast.until > nowMs ? lastToast.msg : "";
    const rowKey = (rows: readonly StashRowView[]) => rows.map((r) => `${r.index}:${r.itemId}:${r.qty}`).join(",");
    const signature = `${toastText}|${rowKey(stash.inventory)}|${rowKey(stash.entries)}`;
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.footer.setText(toastText);
    this.rebuildRows(stash);
  }

  /** [E] near a stash opens it if not already open — never toggles closed (matches v1's openStashIfNearby). */
  openIfClosed(): void {
    if (this.open) return;
    this.open = true;
    this.lastSignature = null;
    this.panel.setVisible(true);
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.panel.setVisible(false);
  }

  isOpen(): boolean {
    return this.open;
  }

  /** Shared hit-claim convention (see inventoryWindow.ts's hitTestPanel doc comment). */
  hitTestPanel(screenX: number, screenY: number): boolean {
    return this.open && this.hitArea.getBounds().contains(screenX, screenY);
  }

  resize(registry: WidgetRegistry, viewport: Viewport): void {
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (layout) syncWidgetContainer(this.container, layout);
  }
}
