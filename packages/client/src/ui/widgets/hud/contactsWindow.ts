import type Phaser from "phaser";
import { uiTextStyle } from "../../font.js";
import { drawPanelBackground, PANEL_BORDER, PANEL_FILL, spacing } from "../../panel.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";
import { buildCloseButton, type CloseButtonHandle } from "./closeButton.js";
import { contactRowViews, type ContactData, type ContactRowView } from "./contactRows.js";
import { WINDOW_PANEL_HEIGHT, WINDOW_VERTICAL_OFFSET } from "./windowLayout.js";
const WIDGET_ID = "contacts";
const PANEL_WIDTH = 220;
const PANEL_HEIGHT = WINDOW_PANEL_HEIGHT;
const TITLE_HEIGHT = 24;
const ROW_HEIGHT = 28;
const DM_WIDTH = 40;
const DM_HEIGHT = 18;
const MAX_VISIBLE_ROWS = Math.floor((PANEL_HEIGHT - TITLE_HEIGHT - spacing(2)) / ROW_HEIGHT);
export interface ContactsActions {
    startDm(name: string): void;
}
interface ContactsWindowOptions {
    scene: Phaser.Scene;
    registry: WidgetRegistry;
    viewport: Viewport;
    actions: ContactsActions;
}
export class ContactsWindowWidget {
    private readonly scene: Phaser.Scene;
    private readonly container: Phaser.GameObjects.Container;
    private readonly panel: Phaser.GameObjects.Container;
    private readonly hitArea: Phaser.GameObjects.Rectangle;
    private readonly closeButton: CloseButtonHandle;
    private readonly actions: ContactsActions;
    private rowObjects: Phaser.GameObjects.GameObject[] = [];
    private open = false;
    private lastSignature: string | null = null;
    private readonly scale: number;
    constructor({ scene, registry, viewport, actions }: ContactsWindowOptions) { this.scene = scene;
this.actions = actions;
registry.register({ id: WIDGET_ID, defaultAnchor: "center", defaultOffset: { x: 0, y: WINDOW_VERTICAL_OFFSET }, defaultScale: 1, defaultVisible: true, });
const layout = registry.resolve(viewport).get(WIDGET_ID)!;
this.scale = layout.scale;
this.container = createWidgetContainer(scene, layout);
this.panel = scene.add.container(0, 0);
this.container.add(this.panel);
const bg = drawPanelBackground(scene, PANEL_WIDTH, PANEL_HEIGHT).setPosition(-PANEL_WIDTH / 2, -PANEL_HEIGHT / 2);
this.hitArea = scene.add.rectangle(-PANEL_WIDTH / 2, -PANEL_HEIGHT / 2, PANEL_WIDTH, PANEL_HEIGHT, 0x000000, 0).setOrigin(0, 0);
const title = scene.add.text(0, -PANEL_HEIGHT / 2 + TITLE_HEIGHT / 2, "CONTACTS", uiTextStyle(12, undefined, { scale: this.scale, weight: "emphasis" })).setOrigin(0.5, 0.5);
this.closeButton = buildCloseButton({ scene, panelWidth: PANEL_WIDTH, panelHeight: PANEL_HEIGHT, containerScale: this.scale, onClose: () => this.close() });
this.panel.add([bg, this.hitArea, title, ...this.closeButton.objects]);
this.panel.setVisible(false);
}
    private rebuildRows(views: ContactRowView[]): void { for (const obj of this.rowObjects)
        obj.destroy();
this.rowObjects = [];
const top = -PANEL_HEIGHT / 2 + TITLE_HEIGHT + spacing(1);
if (views.length === 0) {
        const empty = this.scene.add.text(0, top + spacing(2), "No contacts yet — hold F near someone", uiTextStyle(10, "#6b6b7e", { scale: this.scale })).setOrigin(0.5, 0);
        this.panel.add(empty);
        this.rowObjects.push(empty);
        return;
    } views.slice(0, MAX_VISIBLE_ROWS).forEach((view, index) => { this.rowObjects.push(...this.buildRow(view, top + index * ROW_HEIGHT));
});
}
    private buildRow(view: ContactRowView, y: number): Phaser.GameObjects.GameObject[] { const left = -PANEL_WIDTH / 2 + spacing(1);
const right = PANEL_WIDTH / 2 - spacing(1);
const dot = this.scene.add.circle(left + 4, y + ROW_HEIGHT / 2, 3, view.online ? 0x4ade80 : 0x6b6b7e);
const label = this.scene.add.text(left + 14, y + ROW_HEIGHT / 2, view.name, uiTextStyle(11, undefined, { scale: this.scale })).setOrigin(0, 0.5);
const dmBtn = this.buildDmButton(view.name, right - DM_WIDTH, y + (ROW_HEIGHT - DM_HEIGHT) / 2);
const objects = [dot, label, ...dmBtn];
this.panel.add(objects);
return objects;
}
    private buildDmButton(name: string, x: number, y: number): Phaser.GameObjects.GameObject[] { const bg = this.scene.add.rectangle(x, y, DM_WIDTH, DM_HEIGHT, PANEL_FILL, 0.9).setOrigin(0, 0).setStrokeStyle(1, PANEL_BORDER).setInteractive({ useHandCursor: true });
bg.on("pointerdown", () => this.actions.startDm(name));
const text = this.scene.add.text(x + DM_WIDTH / 2, y + DM_HEIGHT / 2, "DM", uiTextStyle(9, undefined, { scale: this.scale })).setOrigin(0.5, 0.5);
return [bg, text];
}
    update(contacts: readonly ContactData[]): void { if (!this.open)
        return;
const signature = contacts.map((c) => `${c.name}:${c.online}`).join(",");
if (signature === this.lastSignature)
        return;
this.lastSignature = signature;
this.rebuildRows(contactRowViews(contacts));
}
    toggle(): void { if (this.open)
        this.close();
    else
        this.openWindow();
}
    close(): void { if (!this.open)
        return;
this.open = false;
this.panel.setVisible(false);
}
    private openWindow(): void { this.open = true;
this.lastSignature = null;
this.panel.setVisible(true);
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
