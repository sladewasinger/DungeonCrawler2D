/* eslint-disable max-lines -- the window owns its row lifecycle and interaction state. */
import type Phaser from "phaser";
import { uiTextStyle } from "../../../foundation/font.js";
import { drawPanelBackground, PANEL_BORDER, PANEL_FILL, spacing } from "../../../foundation/panel.js";
import { createWidgetContainer, syncWidgetContainer } from "../../container.js";
import type { WidgetRegistry } from "../../registry.js";
import type { Viewport } from "../../state.js";
import { buildCloseButton, type CloseButtonHandle } from "./closeButton.js";
import type { StashSnapshot, ToastData } from "../core/fakeData.js";
import { createItemIcon } from "../inventory/itemIcon.js";
import type { StashRowView } from "./stashRows.js";
import { WINDOW_PANEL_HEIGHT, WINDOW_VERTICAL_OFFSET } from "./windowLayout.js";
const WIDGET_ID = "stash";
const PANEL_WIDTH_MAX = 440;
const VIEWPORT_MARGIN = 64;
const PANEL_HEIGHT = WINDOW_PANEL_HEIGHT;
const TITLE_HEIGHT = 24;
const ROW_HEIGHT = 28;
const ICON_SIZE = 20;
const BTN_WIDTH = 44;
const BTN_HEIGHT = 18;
const MAX_VISIBLE_ROWS = Math.floor((PANEL_HEIGHT - TITLE_HEIGHT - spacing(3)) / ROW_HEIGHT);
export function resolvePanelWidth(viewport: Viewport): number { return Math.min(PANEL_WIDTH_MAX, viewport.width - VIEWPORT_MARGIN);
}
export interface StashActions {
    put(index: number): void;
    take(index: number, itemId: string): void;
    takeAll(): void;
    close(): void;
}
interface ColumnSpec {
    x: number;
    title: string;
    buttonLabel: string | null;
    onClick: (index: number, itemId: string) => void;
}
function stashUpdateView(stash: StashSnapshot, lastToast: ToastData | null, nowMs: number): {
    toastText: string;
    signature: string;
} { const toastText = lastToast && lastToast.until > nowMs ? lastToast.msg : "";
const rowKey = (rows: readonly StashRowView[]) => rows.map((row) => row.index + ":" + row.itemId + ":" + row.qty).join(",");
return { toastText, signature: toastText + "|" + rowKey(stash.inventory) + "|" + rowKey(stash.entries) };
}
export interface StashWindowOptions {
    scene: Phaser.Scene;
    registry: WidgetRegistry;
    viewport: Viewport;
    actions: StashActions;
}
interface StashButtonRequest {
    column: ColumnSpec;
    view: StashRowView;
    x: number;
    y: number;
}
export class StashWindowWidget {
    private readonly scene: Phaser.Scene;
    private readonly container: Phaser.GameObjects.Container;
    private readonly panel: Phaser.GameObjects.Container;
    private readonly hitArea: Phaser.GameObjects.Rectangle;
    private readonly closeButton: CloseButtonHandle;
    private readonly footer: Phaser.GameObjects.Text;
    private readonly actions: StashActions;
    private readonly columnTitles: Phaser.GameObjects.Text[] = [];
    private readonly takeAllButton: Phaser.GameObjects.Text;
    private rowObjects: Phaser.GameObjects.GameObject[] = [];
    private open = false;
    private lastSignature: string | null = null;
    private readonly scale: number;
    private readonly panelWidth: number;
    private readonly columnWidth: number;
    constructor({ scene, registry, viewport, actions }: StashWindowOptions) { this.scene = scene;
this.actions = actions;
this.panelWidth = resolvePanelWidth(viewport);
this.columnWidth = (this.panelWidth - spacing(3)) / 2;
registry.register({ id: WIDGET_ID, defaultAnchor: "center", defaultOffset: { x: 0, y: WINDOW_VERTICAL_OFFSET }, defaultScale: 1, defaultVisible: true, });
const layout = registry.resolve(viewport).get(WIDGET_ID)!;
this.scale = layout.scale;
this.container = createWidgetContainer(scene, layout);
this.panel = scene.add.container(0, 0);
this.container.add(this.panel);
const bg = drawPanelBackground(scene, this.panelWidth, PANEL_HEIGHT).setPosition(-this.panelWidth / 2, -PANEL_HEIGHT / 2);
this.hitArea = scene.add.rectangle(-this.panelWidth / 2, -PANEL_HEIGHT / 2, this.panelWidth, PANEL_HEIGHT, 0x000000, 0).setOrigin(0, 0);
this.footer = scene.add.text(0, PANEL_HEIGHT / 2 - spacing(1.5), "", uiTextStyle(10, "#c8ecf7", { scale: this.scale })).setOrigin(0.5, 1);
this.closeButton = buildCloseButton({ scene, panelWidth: this.panelWidth, panelHeight: PANEL_HEIGHT, containerScale: this.scale, onClose: () => this.close() });
this.takeAllButton = scene.add.text(this.panelWidth / 2 - spacing(1), -PANEL_HEIGHT / 2 + TITLE_HEIGHT / 2, "[ Take all ]", uiTextStyle(10, "#ffd86a", { scale: this.scale, weight: "emphasis" })).setOrigin(1, 0.5).setInteractive({ useHandCursor: true }).on("pointerdown", () => this.actions.takeAll()).setVisible(false);
this.panel.add([bg, this.hitArea, this.footer, this.takeAllButton, ...this.closeButton.objects]);
this.buildColumnTitles();
this.panel.setVisible(false);
}
    private columns(kind: StashSnapshot["kind"] = "personal"): [
        ColumnSpec,
        ColumnSpec
    ] { const left = -this.panelWidth / 2 + spacing(1);
const right = spacing(0.5);
return [{ x: left, title: "INVENTORY", buttonLabel: kind === "loot" ? null : "Put", onClick: (i) => this.actions.put(i) }, { x: right, title: kind === "loot" ? "LOOT" : "STASH", buttonLabel: "Take", onClick: (i, item) => this.actions.take(i, item) },];
}
    private buildColumnTitles(): void { const y = -PANEL_HEIGHT / 2 + TITLE_HEIGHT / 2;
for (const column of this.columns()) {
        const label = this.scene.add.text(column.x + this.columnWidth / 2, y, column.title, uiTextStyle(11, undefined, { scale: this.scale, weight: "emphasis" })).setOrigin(0.5, 0.5);
        this.panel.add(label);
        this.columnTitles.push(label);
    } }
    private rebuildRows(stash: StashSnapshot): void { for (const obj of this.rowObjects)
        obj.destroy();
this.rowObjects = [];
const [inventoryColumn, stashColumn] = this.columns(stash.kind);
this.rebuildColumn(inventoryColumn, stash.inventory);
this.rebuildColumn(stashColumn, stash.entries);
}
    private rebuildColumn(column: ColumnSpec, rows: readonly StashRowView[]): void { const top = -PANEL_HEIGHT / 2 + TITLE_HEIGHT + spacing(1);
rows.slice(0, MAX_VISIBLE_ROWS).forEach((view, i) => { this.rowObjects.push(...this.buildRow(column, view, top + i * ROW_HEIGHT));
});
}
    private buildRow(column: ColumnSpec, view: StashRowView, y: number): Phaser.GameObjects.GameObject[] { const left = column.x;
const rowBg = this.scene.add.rectangle(left, y, this.columnWidth, ROW_HEIGHT - 2, PANEL_FILL, 0.4).setOrigin(0, 0);
const icon = createItemIcon({ scene: this.scene, itemId: view.itemId, size: ICON_SIZE, containerScale: this.scale }).setPosition(left + ICON_SIZE / 2 + 4, y + (ROW_HEIGHT - 2) / 2);
const btnX = left + this.columnWidth - (column.buttonLabel ? BTN_WIDTH : 0);
const name = this.scene.add.text(left + ICON_SIZE + spacing(1), y + (ROW_HEIGHT - 2) / 2, `${view.name} ×${view.qty}`, uiTextStyle(10, undefined, { scale: this.scale })).setOrigin(0, 0.5).setFixedSize(btnX - (left + ICON_SIZE + spacing(1)) - 4, 0);
const button = column.buttonLabel ? this.buildButton({ column, view, x: btnX, y: y + (ROW_HEIGHT - 2 - BTN_HEIGHT) / 2 }) : [];
const objects = [rowBg, icon, name, ...button];
this.panel.add(objects);
return objects;
}
    private buildButton({ column, view, x, y }: StashButtonRequest): Phaser.GameObjects.GameObject[] { const bg = this.scene.add.rectangle(x, y, BTN_WIDTH, BTN_HEIGHT, PANEL_FILL, 0.9).setOrigin(0, 0).setStrokeStyle(1, PANEL_BORDER).setInteractive({ useHandCursor: true });
bg.on("pointerdown", () => column.onClick(view.index, view.itemId));
const text = this.scene.add.text(x + BTN_WIDTH / 2, y + BTN_HEIGHT / 2, column.buttonLabel ?? "", uiTextStyle(9, undefined, { scale: this.scale })).setOrigin(0.5, 0.5);
return [bg, text];
}
    update(stash: StashSnapshot, lastToast: ToastData | null, nowMs: number): void { if (!this.open)
        return;
if (!stash.nearby) {
        this.close();
        return;
    } const { toastText, signature } = stashUpdateView(stash, lastToast, nowMs);
if (signature === this.lastSignature)
        return;
this.lastSignature = signature;
this.footer.setText(toastText);
const [, right] = this.columns(stash.kind);
this.columnTitles[1]?.setText(right.title);
this.takeAllButton.setVisible(stash.kind === "loot" && stash.entries.length > 0);
this.rebuildRows(stash);
}
    openIfClosed(): void { if (this.open)
        return;
this.open = true;
this.lastSignature = null;
this.panel.setVisible(true);
}
    close(): void { if (!this.open)
        return;
this.open = false;
this.panel.setVisible(false);
this.actions.close();
}
    isOpen(): boolean { return this.open;
}
    hitTestPanel(screenX: number, screenY: number): boolean { if (!this.open)
        return false;
return this.hitArea.getBounds().contains(screenX, screenY) || this.closeButton.hitArea.getBounds().contains(screenX, screenY);
}
    resize(registry: WidgetRegistry, viewport: Viewport): void { const layout = registry.resolve(viewport).get(WIDGET_ID);
if (layout)
        syncWidgetContainer(this.container, layout);
}
}
