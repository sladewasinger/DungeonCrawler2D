/**
 * Chat panel HUD widget: toggleable, 4 real tabs (global/local/party/dm — driven by
 * ui/chat/controller.ts's ChatPanelModel) with unread dots on inactive tabs and the dm
 * tab dimmed until its first traffic. On touch layouts (mobile pass) it starts collapsed
 * behind a small always-visible "CHAT" toggle chip near the anchor, so the full panel
 * doesn't fight the bottom-left joystick for space — HudWidgets passes collapsedDefault
 * from input/touchDetect.ts and relocates this widget's offset for touch via the registry.
 */
import type Phaser from "phaser";
import type { ChatPanelModel, ChatTabView } from "../../chat/controller.js";
import type { ChatTabId } from "../../chat/chatTabs.js";
import { uiTextStyle } from "../../font.js";
import { drawPanelBackground, drawSelectionAccent, PANEL_BORDER, spacing } from "../../panel.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";

const WIDGET_ID = "chat";
// default-layout.json anchors chat well above the hotbar now (offset y clears its
// hudScale-doubled height — see default-layout.json's "chat" entry), so the only
// remaining collision risk at the mobile-ish 900px breakpoint (docs/PORT_PLAN.md UI
// wave) is the centered interaction prompt: narrow enough that this panel's
// hudScale-doubled right edge clears its hudScale-doubled left edge — see interactionPrompt.ts.
const PANEL_WIDTH = 190;
const PANEL_HEIGHT = 110;
const MAX_LINES = 4;
const TAB_WIDTH = 44;
const TAB_HEIGHT = 18;
const LINE_HEIGHT = 16;
const CHIP_WIDTH = 64;
const CHIP_HEIGHT = 22;
const CONTACTS_CHIP_SIZE = 20;
const TAB_LABELS: Record<ChatTabId, string> = { global: "GLBL", local: "LOCAL", party: "PARTY", dm: "DM" };
// Wide/tall enough to cover the bg, the tab strip, and the contacts chip that sits past
// the bg's right edge — see hitTestPanel's doc comment for why this needs to exist at all.
const PANEL_HIT_WIDTH = Math.max(PANEL_WIDTH, spacing(0.5) + 4 * (TAB_WIDTH + 2) + 4 + CONTACTS_CHIP_SIZE);
const PANEL_HIT_HEIGHT = PANEL_HEIGHT + TAB_HEIGHT;

export interface ChatPanelActions {
  onSelectTab(tab: ChatTabId): void;
  /** The "o" chip beside the tab strip — same intent as the [o] key (Epic 7.10). */
  onToggleContacts(): void;
}

export class ChatPanelWidget {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  /** bg/tabs/lines live here so the always-visible touch chip (added to `container`) toggles independently. */
  private readonly panel: Phaser.GameObjects.Container;
  private readonly tabAccents = new Map<ChatTabId, Phaser.GameObjects.Graphics>();
  private readonly tabDots = new Map<ChatTabId, Phaser.GameObjects.Arc>();
  private readonly tabLabels = new Map<ChatTabId, Phaser.GameObjects.Text>();
  private readonly lineTexts: Phaser.GameObjects.Text[] = [];
  private readonly touchMode: boolean;
  private readonly hitArea: Phaser.GameObjects.Rectangle;
  private toggleChipBg: Phaser.GameObjects.Rectangle | undefined;
  private open: boolean;

  constructor(
    scene: Phaser.Scene,
    registry: WidgetRegistry,
    viewport: Viewport,
    actions: ChatPanelActions,
    collapsedDefault = false,
  ) {
    this.scene = scene;
    this.touchMode = collapsedDefault;
    this.open = !collapsedDefault;
    registry.register({
      id: WIDGET_ID,
      defaultAnchor: "bottom-left",
      defaultOffset: { x: 16, y: -16 },
      defaultScale: 1,
      defaultVisible: true,
    });
    // Registered synchronously above, so this id is always present in the resolved map.
    const layout = registry.resolve(viewport).get(WIDGET_ID)!;
    this.container = createWidgetContainer(scene, layout);
    this.panel = scene.add.container(0, this.touchMode ? -CHIP_HEIGHT : 0);
    this.container.add(this.panel);
    const bg = drawPanelBackground(scene, PANEL_WIDTH, PANEL_HEIGHT).setPosition(0, -PANEL_HEIGHT);
    this.hitArea = scene.add
      .rectangle(0, -PANEL_HIT_HEIGHT, PANEL_HIT_WIDTH, PANEL_HIT_HEIGHT, 0x000000, 0)
      .setOrigin(0, 0);
    this.panel.add([bg, this.hitArea]);
    this.buildTabs(actions);
    this.buildContactsChip(actions);
    this.buildLines();
    if (this.touchMode) this.buildToggleChip();
    this.panel.setVisible(this.open);
  }

  /** Small "o" chip sitting right of the tab strip — opens the contacts window. Its own
   * `pointerdown` listener owns the click (same direct-interactive pattern as the tabs
   * above and the contacts window's own DM button), so no stored reference is needed. */
  private buildContactsChip(actions: ChatPanelActions): void {
    const tabsWidth = 4 * (TAB_WIDTH + 2);
    const x = spacing(0.5) + tabsWidth + 4;
    const y = -PANEL_HEIGHT;
    const bg = this.scene.add
      .rectangle(x, y, CONTACTS_CHIP_SIZE, TAB_HEIGHT, 0x14141c)
      .setOrigin(0, 0)
      .setStrokeStyle(1, PANEL_BORDER)
      .setInteractive({ useHandCursor: true });
    bg.on("pointerdown", () => actions.onToggleContacts());
    const label = this.scene.add
      .text(x + CONTACTS_CHIP_SIZE / 2, y + TAB_HEIGHT / 2, "o", uiTextStyle(10))
      .setOrigin(0.5, 0.5);
    this.panel.add([bg, label]);
  }

  private buildTabs(actions: ChatPanelActions): void {
    (Object.keys(TAB_LABELS) as ChatTabId[]).forEach((tab, i) => {
      const x = spacing(0.5) + i * (TAB_WIDTH + 2);
      const y = -PANEL_HEIGHT;
      const tabBg = this.scene.add
        .rectangle(x, y, TAB_WIDTH, TAB_HEIGHT, 0x14141c)
        .setOrigin(0, 0)
        .setStrokeStyle(1, PANEL_BORDER)
        .setInteractive({ useHandCursor: true });
      tabBg.on("pointerdown", () => actions.onSelectTab(tab));
      const label = this.scene.add.text(x + TAB_WIDTH / 2, y + TAB_HEIGHT / 2, TAB_LABELS[tab], uiTextStyle(9)).setOrigin(0.5, 0.5);
      const accent = drawSelectionAccent(this.scene, TAB_WIDTH, TAB_HEIGHT).setPosition(x, y).setVisible(false);
      const dot = this.scene.add.circle(x + TAB_WIDTH - 5, y + 4, 2.5, 0xffd23d).setVisible(false);
      this.panel.add([tabBg, label, accent, dot]);
      this.tabAccents.set(tab, accent);
      this.tabDots.set(tab, dot);
      this.tabLabels.set(tab, label);
    });
  }

  private buildLines(): void {
    for (let i = 0; i < MAX_LINES; i++) {
      const y = -PANEL_HEIGHT + TAB_HEIGHT + spacing(1) + i * LINE_HEIGHT;
      const text = this.scene.add.text(spacing(1), y, "", uiTextStyle(11)).setOrigin(0, 0);
      this.panel.add(text);
      this.lineTexts.push(text);
    }
  }

  /** The persistent "CHAT" toggle chip, sitting where the panel's bottom edge would be — always visible on touch. */
  private buildToggleChip(): void {
    const bg = this.scene.add.rectangle(0, -CHIP_HEIGHT, CHIP_WIDTH, CHIP_HEIGHT, 0x14141c).setOrigin(0, 0).setStrokeStyle(1, PANEL_BORDER);
    const label = this.scene.add.text(CHIP_WIDTH / 2, -CHIP_HEIGHT / 2, "CHAT", uiTextStyle(10)).setOrigin(0.5, 0.5);
    this.container.add([bg, label]);
    this.toggleChipBg = bg;
  }

  /** Screen-space hit test for the touch toggle chip — false (never hit) when this widget isn't in touch mode. */
  hitTestToggle(screenX: number, screenY: number): boolean {
    return this.toggleChipBg !== undefined && this.toggleChipBg.getBounds().contains(screenX, screenY);
  }

  /** Shared hit-claim convention (see inventoryWindow.ts's hitTestPanel doc comment): while
   * open, claims any click over the tab strip/contacts chip/message lines so it never falls
   * through to a world swing or throw — the tabs' and chip's own `pointerdown` listeners
   * (registered directly on those Phaser objects, not routed through this hit test) still
   * fire independently and do the actual tab-select/contacts-toggle work. */
  hitTestPanel(screenX: number, screenY: number): boolean {
    return this.open && this.hitArea.getBounds().contains(screenX, screenY);
  }

  /** Toggles the panel open/closed (bound to a chat key, or the touch toggle chip). */
  toggle(): void {
    this.open = !this.open;
    this.panel.setVisible(this.open);
  }

  private updateTab(view: ChatTabView): void {
    this.tabAccents.get(view.id)?.setVisible(view.active);
    this.tabDots.get(view.id)?.setVisible(view.unread && !view.active);
    this.tabLabels.get(view.id)?.setColor(view.dim ? "#6b6b7e" : "#e8e8e8");
  }

  update(model: ChatPanelModel): void {
    for (const tab of model.tabs) this.updateTab(tab);
    const visible = model.lines.slice(-MAX_LINES);
    this.lineTexts.forEach((text, i) => {
      const line = visible[i];
      text.setText(line ? `${line.author}: ${line.text}` : "");
    });
  }

  /** Re-resolves this widget's screen position for a new viewport (call on resize). */
  resize(registry: WidgetRegistry, viewport: Viewport): void {
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (layout) syncWidgetContainer(this.container, layout);
  }
}
