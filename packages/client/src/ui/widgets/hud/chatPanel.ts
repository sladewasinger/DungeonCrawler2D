/**
 * Minimal chat panel HUD widget: toggleable, stub channel tabs (local/party — no
 * backend wiring yet, per PORT_PLAN.md's core slice), recent lines in the pixel
 * font. On touch layouts (mobile pass) it starts collapsed behind a small always-
 * visible "CHAT" toggle chip near the anchor, so the full panel doesn't fight the
 * bottom-left joystick for space — HudWidgets passes collapsedDefault from
 * input/touchDetect.ts and relocates this widget's offset for touch via the registry.
 */
import type Phaser from "phaser";
import { pixelTextStyle } from "../../font.js";
import { drawPanelBackground, drawSelectionAccent, PANEL_BORDER, spacing } from "../../panel.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";
import type { ChatChannel, ChatLineData } from "./fakeData.js";

const WIDGET_ID = "chat";
// default-layout.json anchors chat well above the hotbar now (offset y clears its
// hudScale-doubled height — see default-layout.json's "chat" entry), so the only
// remaining collision risk at the mobile-ish 900px breakpoint (docs/PORT_PLAN.md UI
// wave) is the centered interaction prompt: narrow enough that this panel's
// hudScale-doubled right edge clears its hudScale-doubled left edge — see interactionPrompt.ts.
const PANEL_WIDTH = 160;
const PANEL_HEIGHT = 110;
const MAX_LINES = 4;
const CHANNELS: readonly ChatChannel[] = ["local", "party"];
const TAB_WIDTH = 56;
const TAB_HEIGHT = 18;
const LINE_HEIGHT = 16;
const CHIP_WIDTH = 64;
const CHIP_HEIGHT = 22;

export class ChatPanelWidget {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  /** bg/tabs/lines live here so the always-visible touch chip (added to `container`) toggles independently. */
  private readonly panel: Phaser.GameObjects.Container;
  private readonly tabAccents = new Map<ChatChannel, Phaser.GameObjects.Graphics>();
  private readonly lineTexts: Phaser.GameObjects.Text[] = [];
  private readonly touchMode: boolean;
  private toggleChipBg: Phaser.GameObjects.Rectangle | undefined;
  private open: boolean;

  constructor(scene: Phaser.Scene, registry: WidgetRegistry, viewport: Viewport, collapsedDefault = false) {
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
    this.panel.add(bg);
    this.buildTabs();
    this.buildLines();
    if (this.touchMode) this.buildToggleChip();
    this.panel.setVisible(this.open);
  }

  private buildTabs(): void {
    CHANNELS.forEach((channel, i) => {
      const x = spacing(0.5) + i * (TAB_WIDTH + 4);
      const y = -PANEL_HEIGHT;
      const tabBg = this.scene.add.rectangle(x, y, TAB_WIDTH, TAB_HEIGHT, 0x14141c).setOrigin(0, 0).setStrokeStyle(1, PANEL_BORDER);
      const label = this.scene.add.text(x + TAB_WIDTH / 2, y + TAB_HEIGHT / 2, channel, pixelTextStyle(10)).setOrigin(0.5, 0.5);
      const accent = drawSelectionAccent(this.scene, TAB_WIDTH, TAB_HEIGHT).setPosition(x, y).setVisible(false);
      this.panel.add([tabBg, label, accent]);
      this.tabAccents.set(channel, accent);
    });
  }

  private buildLines(): void {
    for (let i = 0; i < MAX_LINES; i++) {
      const y = -PANEL_HEIGHT + TAB_HEIGHT + spacing(1) + i * LINE_HEIGHT;
      const text = this.scene.add.text(spacing(1), y, "", pixelTextStyle(11)).setOrigin(0, 0);
      this.panel.add(text);
      this.lineTexts.push(text);
    }
  }

  /** The persistent "CHAT" toggle chip, sitting where the panel's bottom edge would be — always visible on touch. */
  private buildToggleChip(): void {
    const bg = this.scene.add.rectangle(0, -CHIP_HEIGHT, CHIP_WIDTH, CHIP_HEIGHT, 0x14141c).setOrigin(0, 0).setStrokeStyle(1, PANEL_BORDER);
    const label = this.scene.add.text(CHIP_WIDTH / 2, -CHIP_HEIGHT / 2, "CHAT", pixelTextStyle(10)).setOrigin(0.5, 0.5);
    this.container.add([bg, label]);
    this.toggleChipBg = bg;
  }

  /** Screen-space hit test for the touch toggle chip — false (never hit) when this widget isn't in touch mode. */
  hitTestToggle(screenX: number, screenY: number): boolean {
    return this.toggleChipBg !== undefined && this.toggleChipBg.getBounds().contains(screenX, screenY);
  }

  /** Toggles the panel open/closed (bound to a chat key, or the touch toggle chip). */
  toggle(): void {
    this.open = !this.open;
    this.panel.setVisible(this.open);
  }

  update(lines: ChatLineData[], activeChannel: ChatChannel): void {
    for (const [channel, accent] of this.tabAccents) accent.setVisible(channel === activeChannel);
    const visible = lines.filter((line) => line.channel === activeChannel).slice(-MAX_LINES);
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
