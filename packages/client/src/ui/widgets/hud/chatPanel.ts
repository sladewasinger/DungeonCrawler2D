/**
 * Minimal chat panel HUD widget: toggleable, stub channel tabs (local/party — no
 * backend wiring yet, per PORT_PLAN.md's core slice), recent lines in the pixel font.
 */
import type Phaser from "phaser";
import { pixelTextStyle } from "../../font.js";
import { drawPanelBackground, drawSelectionAccent, PANEL_BORDER, spacing } from "../../panel.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";
import type { ChatChannel, ChatLineData } from "./fakeData.js";

const WIDGET_ID = "chat";
// Narrow enough to clear the centered hotbar's left edge at the mobile-ish 900px
// breakpoint (docs/PORT_PLAN.md UI wave) without overlapping it — see hotbar.ts.
const PANEL_WIDTH = 220;
const PANEL_HEIGHT = 110;
const MAX_LINES = 4;
const CHANNELS: readonly ChatChannel[] = ["local", "party"];
const TAB_WIDTH = 56;
const TAB_HEIGHT = 18;
const LINE_HEIGHT = 16;

export class ChatPanelWidget {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly tabAccents = new Map<ChatChannel, Phaser.GameObjects.Graphics>();
  private readonly lineTexts: Phaser.GameObjects.Text[] = [];
  private open = true;

  constructor(scene: Phaser.Scene, registry: WidgetRegistry, viewport: Viewport) {
    this.scene = scene;
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
    const bg = drawPanelBackground(scene, PANEL_WIDTH, PANEL_HEIGHT).setPosition(0, -PANEL_HEIGHT);
    this.container.add(bg);
    this.buildTabs();
    this.buildLines();
  }

  private buildTabs(): void {
    CHANNELS.forEach((channel, i) => {
      const x = spacing(0.5) + i * (TAB_WIDTH + 4);
      const y = -PANEL_HEIGHT;
      const tabBg = this.scene.add.rectangle(x, y, TAB_WIDTH, TAB_HEIGHT, 0x14141c).setOrigin(0, 0).setStrokeStyle(1, PANEL_BORDER);
      const label = this.scene.add.text(x + TAB_WIDTH / 2, y + TAB_HEIGHT / 2, channel, pixelTextStyle(10)).setOrigin(0.5, 0.5);
      const accent = drawSelectionAccent(this.scene, TAB_WIDTH, TAB_HEIGHT).setPosition(x, y).setVisible(false);
      this.container.add([tabBg, label, accent]);
      this.tabAccents.set(channel, accent);
    });
  }

  private buildLines(): void {
    for (let i = 0; i < MAX_LINES; i++) {
      const y = -PANEL_HEIGHT + TAB_HEIGHT + spacing(1) + i * LINE_HEIGHT;
      const text = this.scene.add.text(spacing(1), y, "", pixelTextStyle(11)).setOrigin(0, 0);
      this.container.add(text);
      this.lineTexts.push(text);
    }
  }

  /** Toggles the panel open/closed (bound to a chat key by the caller). */
  toggle(): void {
    this.open = !this.open;
    this.container.setVisible(this.open);
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
