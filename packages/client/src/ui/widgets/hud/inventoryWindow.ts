/**
 * Inventory window HUD widget: registry id "inventory" — a fixed ~340x300 center
 * panel with All/Weapons/Usables/Materials filter tabs, one row per InvStack (icon,
 * name, qty, hotbar-bind tag), click-to-select for the [1-9] bind flow (input/hotbar.ts),
 * and per-row Equip/Unequip + Drop buttons. Not resizable yet (HUD_OS.md Phase 1) — rows
 * just cap to what the fixed panel height holds, no scroll region. Every tab/row/button
 * here is a real interactive Phaser game object (HUD_OS.md's Phase 1 note), not routed
 * through HudWidgets.hitTest()'s string-tag dispatch — hitTestPanel() below only exists
 * so that dispatch can claim clicks *inside* the panel for the world-swing fallback.
 * Split from inventoryRows.ts's pure filter/sort view-model, mirroring hotbar.ts/hotbarSlots.ts.
 */
import type Phaser from "phaser";
import { uiTextStyle } from "../../font.js";
import { drawPanelBackground, drawSelectionAccent, PANEL_BORDER, spacing } from "../../panel.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";
import { buildCloseButton, type CloseButtonHandle } from "./closeButton.js";
import type { InventoryRowData } from "./fakeData.js";
import { buildInventoryRow } from "./inventoryRowBuilder.js";
import { INVENTORY_TABS, inventoryRowViews, type InventoryRowView, type InventoryTabId } from "./inventoryRows.js";
import { WINDOW_PANEL_HEIGHT, WINDOW_VERTICAL_OFFSET } from "./windowLayout.js";

const WIDGET_ID = "inventory";
const PANEL_WIDTH = 340;
const PANEL_HEIGHT = WINDOW_PANEL_HEIGHT;
const TAB_HEIGHT = 22;
const ROW_HEIGHT = 32;
const ICON_SIZE = 22;
/** No scroll region in Phase 1 (HUD_OS.md §7) — extra rows simply don't render. */
const MAX_VISIBLE_ROWS = Math.floor((PANEL_HEIGHT - TAB_HEIGHT - spacing(2)) / ROW_HEIGHT);

/** The three network intents this window drives, threaded down from HudScene's actions bundle. */
export interface InventoryActions {
  assignSlot(slot: number, item: string | null): void;
  equip(item: string | null): void;
  drop(item: string): void;
}

export class InventoryWindowWidget {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Container;
  /** Invisible bounds-only rect for hitTestPanel() — drawPanelBackground()'s Graphics object has no getBounds(). */
  private readonly hitArea: Phaser.GameObjects.Rectangle;
  private readonly closeButton: CloseButtonHandle;
  private readonly tabAccents = new Map<InventoryTabId, Phaser.GameObjects.Graphics>();
  private readonly actions: InventoryActions;
  private rowObjects: Phaser.GameObjects.GameObject[] = [];
  private open = false;
  private activeTab: InventoryTabId = "all";
  private selectedItemId: string | null = null;
  private currentWeaponId: string | null = null;
  private lastSignature = "";
  private readonly scale: number;

  constructor(scene: Phaser.Scene, registry: WidgetRegistry, viewport: Viewport, actions: InventoryActions) {
    this.scene = scene;
    this.actions = actions;
    registry.register({
      id: WIDGET_ID,
      defaultAnchor: "center",
      defaultOffset: { x: 0, y: WINDOW_VERTICAL_OFFSET },
      defaultScale: 1,
      defaultVisible: true,
    });
    // Registered synchronously above, so this id is always present in the resolved map.
    const layout = registry.resolve(viewport).get(WIDGET_ID)!;
    this.scale = layout.scale;
    this.container = createWidgetContainer(scene, layout);
    this.panel = scene.add.container(0, 0);
    this.container.add(this.panel);
    const panelBg = drawPanelBackground(scene, PANEL_WIDTH, PANEL_HEIGHT).setPosition(-PANEL_WIDTH / 2, -PANEL_HEIGHT / 2);
    this.hitArea = scene.add
      .rectangle(-PANEL_WIDTH / 2, -PANEL_HEIGHT / 2, PANEL_WIDTH, PANEL_HEIGHT, 0x000000, 0)
      .setOrigin(0, 0);
    this.panel.add([panelBg, this.hitArea]);
    this.buildTabs();
    this.closeButton = buildCloseButton(scene, PANEL_WIDTH, PANEL_HEIGHT, this.scale, () => this.close());
    this.panel.add(this.closeButton.objects);
    this.panel.setVisible(false);
  }

  private buildTabs(): void {
    const tabWidth = (PANEL_WIDTH - spacing(1)) / INVENTORY_TABS.length;
    const y = -PANEL_HEIGHT / 2;
    INVENTORY_TABS.forEach((tab, i) => {
      const x = -PANEL_WIDTH / 2 + spacing(0.5) + i * tabWidth;
      const bg = this.scene.add
        .rectangle(x, y, tabWidth - 2, TAB_HEIGHT, 0x14141c)
        .setOrigin(0, 0)
        .setStrokeStyle(1, PANEL_BORDER)
        .setInteractive({ useHandCursor: true });
      bg.on("pointerdown", () => this.selectTab(tab.id));
      const label = this.scene.add
        .text(x + tabWidth / 2, y + TAB_HEIGHT / 2, tab.label, uiTextStyle(11, undefined, this.scale))
        .setOrigin(0.5, 0.5);
      const accent = drawSelectionAccent(this.scene, tabWidth - 2, TAB_HEIGHT).setPosition(x, y).setVisible(tab.id === this.activeTab);
      this.panel.add([bg, label, accent]);
      this.tabAccents.set(tab.id, accent);
    });
  }

  private selectTab(tab: InventoryTabId): void {
    if (tab === this.activeTab) return;
    this.activeTab = tab;
    this.selectedItemId = null;
    for (const [id, accent] of this.tabAccents) accent.setVisible(id === tab);
  }

  private selectRow(itemId: string): void {
    this.selectedItemId = this.selectedItemId === itemId ? null : itemId;
  }

  /** Rebuilds the visible row list; called from update() only once its signature has changed. */
  private rebuildRows(views: InventoryRowView[]): void {
    for (const obj of this.rowObjects) obj.destroy();
    this.rowObjects = [];
    const top = -PANEL_HEIGHT / 2 + TAB_HEIGHT + spacing(1);
    views.slice(0, MAX_VISIBLE_ROWS).forEach((view, index) => {
      this.rowObjects.push(...this.buildRow(view, top + index * ROW_HEIGHT));
    });
  }

  private buildRow(view: InventoryRowView, y: number): Phaser.GameObjects.GameObject[] {
    const left = -PANEL_WIDTH / 2 + spacing(1);
    const right = PANEL_WIDTH / 2 - spacing(1);
    const objects = buildInventoryRow(
      {
        scene: this.scene,
        scale: this.scale,
        iconSize: ICON_SIZE,
        rowHeight: ROW_HEIGHT,
        currentWeaponId: this.currentWeaponId,
        selectedItemId: this.selectedItemId,
        onSelect: (itemId) => this.selectRow(itemId),
        onEquip: (itemId) => this.actions.equip(itemId),
        onDrop: (itemId) => this.actions.drop(itemId),
      },
      view,
      left,
      right,
      y,
    );
    this.panel.add(objects);
    return objects;
  }

  update(rows: readonly InventoryRowData[], weaponId: string | null): void {
    if (!this.open) return;
    const signature = this.computeSignature(rows, weaponId);
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.currentWeaponId = weaponId;
    this.rebuildRows(inventoryRowViews(rows, this.activeTab));
  }

  private computeSignature(rows: readonly InventoryRowData[], weaponId: string | null): string {
    const rowsKey = rows.map((row) => `${row.itemId}:${row.qty}:${row.boundSlot}`).join(",");
    return `${this.activeTab}|${this.selectedItemId}|${weaponId}|${rowsKey}`;
  }

  /** Bound to [I]/[Tab] and the touch bag button. */
  toggle(): void {
    if (this.open) this.close();
    else this.openWindow();
  }

  /** Bound to [Esc] (InputPanels.closeAll) and the toggle keys/button when already open. */
  close(): void {
    if (!this.open) return;
    this.open = false;
    this.selectedItemId = null;
    this.panel.setVisible(false);
  }

  private openWindow(): void {
    this.open = true;
    this.lastSignature = ""; // force a fresh render of whatever the last snapshot held
    this.panel.setVisible(true);
  }

  isOpen(): boolean {
    return this.open;
  }

  selectedItem(): string | null {
    return this.selectedItemId;
  }

  /**
   * Coarse screen-space bounds check for HudWidgets.hitTest()'s shared dispatch: claims
   * any click inside the open panel so DungeonScene's world-swing/throw fallback never
   * fires through it — the panel's own row/tab/button listeners already handled the click.
   */
  hitTestPanel(screenX: number, screenY: number): boolean {
    if (!this.open) return false;
    return this.hitArea.getBounds().contains(screenX, screenY) || this.closeButton.hitArea.getBounds().contains(screenX, screenY);
  }

  /** Re-resolves this widget's screen position for a new viewport (call on resize). */
  resize(registry: WidgetRegistry, viewport: Viewport): void {
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (layout) syncWidgetContainer(this.container, layout);
  }
}
