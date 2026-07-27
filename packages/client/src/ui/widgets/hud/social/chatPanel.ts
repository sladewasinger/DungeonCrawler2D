/* eslint-disable max-lines -- the panel's rendering and interaction state must stay co-located. */
import type Phaser from "phaser";
import type { ChatPanelModel, ChatTabView } from "../../../chat/controller.js";
import type { ChatTabId } from "../../../chat/chatTabs.js";
import { uiTextStyle } from "../../../foundation/font.js";
import { drawPanelBackground, drawSelectionAccent, PANEL_BORDER, spacing } from "../../../foundation/panel.js";
import { createWidgetContainer, syncWidgetContainer } from "../../container.js";
import type { WidgetRegistry } from "../../registry.js";
import type { Viewport } from "../../state.js";
const WIDGET_ID = "chat";
const PANEL_WIDTH = 190;
const PANEL_HEIGHT = 110;
const MAX_LINES = 4;
const TAB_WIDTH = 44;
const TAB_HEIGHT = 18;
const LINE_HEIGHT = 16;
const CHIP_WIDTH = 64;
const CHIP_HEIGHT = 22;
const CONTACTS_CHIP_SIZE = 56;
const CONTACTS_CHIP_FONT_SIZE = 8;
const TAB_LABELS: Record<ChatTabId, string> = { global: "GLBL", local: "LOCAL", party: "PARTY", dm: "DM" };
const TAB_TOOLTIPS: Record<ChatTabId, string> = { global: "GLBL — everyone on the floor", local: "LOCAL — nearby players", party: "PARTY — your party only", dm: "DM — direct messages", };
const EMPTY_HINT_TEXT = "press [Enter] to chat";
const EMPTY_HINT_ALPHA = 0.5;
const PANEL_HIT_WIDTH = Math.max(PANEL_WIDTH, spacing(0.5) + 4 * (TAB_WIDTH + 2) + 4 + CONTACTS_CHIP_SIZE);
const PANEL_HIT_HEIGHT = PANEL_HEIGHT + TAB_HEIGHT;
export interface ChatPanelActions {
    onSelectTab(tab: ChatTabId): void;
    onToggleContacts(): void;
}
export interface ChatPanelOptions {
    scene: Phaser.Scene;
    registry: WidgetRegistry;
    viewport: Viewport;
    actions: ChatPanelActions;
    collapsedDefault?: boolean;
}
export class ChatPanelWidget {
    private readonly scene: Phaser.Scene;
    private readonly container: Phaser.GameObjects.Container;
    private readonly panel: Phaser.GameObjects.Container;
    private readonly tabAccents = new Map<ChatTabId, Phaser.GameObjects.Graphics>();
    private readonly tabDots = new Map<ChatTabId, Phaser.GameObjects.Arc>();
    private readonly tabLabels = new Map<ChatTabId, Phaser.GameObjects.Text>();
    private readonly lineTexts: Phaser.GameObjects.Text[] = [];
    private readonly touchMode: boolean;
    private readonly hitArea: Phaser.GameObjects.Rectangle;
    private toggleChipBg: Phaser.GameObjects.Rectangle | undefined;
    private open: boolean;
    private readonly scale: number;
    private readonly emptyHint: Phaser.GameObjects.Text;
    private readonly tooltip: Phaser.GameObjects.Text;
    constructor({ scene, registry, viewport, actions, collapsedDefault = false }: ChatPanelOptions) { this.scene = scene;
this.touchMode = collapsedDefault;
this.open = !collapsedDefault;
registry.register({ id: WIDGET_ID, defaultAnchor: "bottom-left", defaultOffset: { x: 16, y: -16 }, defaultScale: 1, defaultVisible: true, });
const layout = registry.resolve(viewport).get(WIDGET_ID)!;
this.scale = layout.scale;
this.container = createWidgetContainer(scene, layout);
this.panel = scene.add.container(0, this.touchMode ? -CHIP_HEIGHT : 0);
this.container.add(this.panel);
const bg = drawPanelBackground(scene, PANEL_WIDTH, PANEL_HEIGHT).setPosition(0, -PANEL_HEIGHT).setAlpha(0.72);
this.hitArea = scene.add.rectangle(0, -PANEL_HIT_HEIGHT, PANEL_HIT_WIDTH, PANEL_HIT_HEIGHT, 0x000000, 0).setOrigin(0, 0);
this.panel.add([bg, this.hitArea]);
this.buildTabs(actions);
this.buildContactsChip(actions);
this.buildLines();
this.emptyHint = this.buildEmptyHint();
this.tooltip = scene.add.text(0, 0, "", uiTextStyle(9, "#c8b98a", { scale: this.scale })).setOrigin(0, 1).setVisible(false);
this.panel.add(this.tooltip);
if (this.touchMode)
        this.buildToggleChip();
this.panel.setVisible(this.open);
}
    private buildContactsChip(actions: ChatPanelActions): void { const tabsWidth = 4 * (TAB_WIDTH + 2);
const x = spacing(0.5) + tabsWidth + 4;
const y = -PANEL_HEIGHT;
const bg = this.scene.add.rectangle(x, y, CONTACTS_CHIP_SIZE, TAB_HEIGHT, 0x14141c).setOrigin(0, 0).setStrokeStyle(1, PANEL_BORDER).setInteractive({ useHandCursor: true });
bg.on("pointerdown", () => actions.onToggleContacts());
const label = this.scene.add.text(x + CONTACTS_CHIP_SIZE / 2, y + TAB_HEIGHT / 2, "CONTACTS", uiTextStyle(CONTACTS_CHIP_FONT_SIZE, undefined, { scale: this.scale })).setOrigin(0.5, 0.5);
this.panel.add([bg, label]);
}
    private buildTabs(actions: ChatPanelActions): void { (Object.keys(TAB_LABELS) as ChatTabId[]).forEach((tab, i) => { const x = spacing(0.5) + i * (TAB_WIDTH + 2);
const y = -PANEL_HEIGHT;
const tabBg = this.scene.add.rectangle(x, y, TAB_WIDTH, TAB_HEIGHT, 0x14141c).setOrigin(0, 0).setStrokeStyle(1, PANEL_BORDER).setInteractive({ useHandCursor: true });
tabBg.on("pointerdown", () => actions.onSelectTab(tab));
tabBg.on("pointerover", () => this.showTooltip(TAB_TOOLTIPS[tab], x + TAB_WIDTH / 2, y));
tabBg.on("pointerout", () => this.tooltip.setVisible(false));
const label = this.scene.add.text(x + TAB_WIDTH / 2, y + TAB_HEIGHT / 2, TAB_LABELS[tab], uiTextStyle(9, undefined, { scale: this.scale })).setOrigin(0.5, 0.5);
const accent = drawSelectionAccent(this.scene, TAB_WIDTH, TAB_HEIGHT).setPosition(x, y).setVisible(false);
const dot = this.scene.add.circle(x + TAB_WIDTH - 5, y + 4, 2.5, 0xffd23d).setVisible(false);
this.panel.add([tabBg, label, accent, dot]);
this.tabAccents.set(tab, accent);
this.tabDots.set(tab, dot);
this.tabLabels.set(tab, label);
});
}
    private buildLines(): void { for (let i = 0;
i < MAX_LINES;
i++) {
        const y = -PANEL_HEIGHT + TAB_HEIGHT + spacing(1) + i * LINE_HEIGHT;
        const text = this.scene.add.text(spacing(1), y, "", uiTextStyle(11, undefined, { scale: this.scale })).setOrigin(0, 0).setWordWrapWidth(PANEL_WIDTH - spacing(2), true).setStyle({ maxLines: 3 });
        this.panel.add(text);
        this.lineTexts.push(text);
    } }
    private buildEmptyHint(): Phaser.GameObjects.Text { const y = -PANEL_HEIGHT + TAB_HEIGHT + (PANEL_HEIGHT - TAB_HEIGHT) / 2;
const text = this.scene.add.text(PANEL_WIDTH / 2, y, EMPTY_HINT_TEXT, uiTextStyle(11, "#9a9aae", { scale: this.scale })).setOrigin(0.5, 0.5).setAlpha(EMPTY_HINT_ALPHA);
this.panel.add(text);
return text;
}
    private showTooltip(text: string, x: number, y: number): void { this.tooltip.setText(text).setPosition(x - this.tooltip.width / 2, y - 4).setVisible(true);
}
    private buildToggleChip(): void { const bg = this.scene.add.rectangle(0, -CHIP_HEIGHT, CHIP_WIDTH, CHIP_HEIGHT, 0x14141c).setOrigin(0, 0).setStrokeStyle(1, PANEL_BORDER);
const label = this.scene.add.text(CHIP_WIDTH / 2, -CHIP_HEIGHT / 2, "CHAT", uiTextStyle(10, undefined, { scale: this.scale })).setOrigin(0.5, 0.5);
this.container.add([bg, label]);
this.toggleChipBg = bg;
}
    hitTestToggle(screenX: number, screenY: number): boolean { return this.toggleChipBg !== undefined && this.toggleChipBg.getBounds().contains(screenX, screenY);
}
    hitTestPanel(screenX: number, screenY: number): boolean { return this.open && this.hitArea.getBounds().contains(screenX, screenY);
}
    toggle(): void { this.open = !this.open;
this.panel.setVisible(this.open);
}
    private updateTab(view: ChatTabView): void { this.tabAccents.get(view.id)?.setVisible(view.active);
this.tabDots.get(view.id)?.setVisible(view.unread && !view.active);
this.tabLabels.get(view.id)?.setColor(view.dim ? "#6b6b7e" : "#e8e8e8");
}
    update(model: ChatPanelModel): void { for (const tab of model.tabs)
        this.updateTab(tab);
const visible = model.lines.slice(-MAX_LINES);
this.lineTexts.forEach((text, i) => { const line = visible[i];
text.setText(line ? `${line.author}: ${line.text}` : "");
});
this.stackLines();
this.emptyHint.setVisible(visible.length === 0);
}
    private stackLines(): void { const top = -PANEL_HEIGHT + TAB_HEIGHT + spacing(1);
let bottom = -spacing(1);
for (let i = this.lineTexts.length - 1;
i >= 0;
i--) {
        const text = this.lineTexts[i]!;
        if (text.text === "") {
            text.setVisible(false);
            continue;
        }
        const y = bottom - text.displayHeight;
        text.setY(y).setVisible(y >= top);
        bottom = y - spacing(0.5);
    } }
    resize(registry: WidgetRegistry, viewport: Viewport): void { const layout = registry.resolve(viewport).get(WIDGET_ID);
if (layout)
        syncWidgetContainer(this.container, layout);
}
}
