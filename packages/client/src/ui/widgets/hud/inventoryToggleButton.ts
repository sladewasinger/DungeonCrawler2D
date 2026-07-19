/**
 * Touch-only "BAG" toggle chip HUD widget: mobile has no [I]/[Tab] keys, so touch
 * layouts get a small always-visible button near the hotbar instead (HUD_OS.md §7
 * Phase 1 — "opens via a small bag button widget near the hotbar"). Hit-tested the
 * same manual way as chat's toggle chip (ChatPanelWidget.hitTestToggle), not a real
 * Phaser interactive object — HudWidgets.hitTest() dispatches it like every other
 * touch control.
 */
import type Phaser from "phaser";
import { uiTextStyle } from "../../font.js";
import { drawPanelBackground } from "../../panel.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";

const WIDGET_ID = "inventory-toggle";
const CHIP_WIDTH = 48;
const CHIP_HEIGHT = 40;
/**
 * Docked directly above the (touch-shrunk) hotbar, centered, clear of the joystick and
 * action-button clusters that flank it on a narrow phone. Offset is pre-hudScale, like
 * every other widget default — tuned against the shipped HUD_SCALE (2) the same way
 * index.ts's other touch overrides (chat/interaction/status) already are.
 */
const OFFSET_X = 0;
const OFFSET_Y = -36;

export class InventoryToggleButtonWidget {
  private readonly container: Phaser.GameObjects.Container;
  /** Invisible bounds-only rect for hitTest() — drawPanelBackground()'s Graphics object has no getBounds(). */
  private readonly hitArea: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, registry: WidgetRegistry, viewport: Viewport) {
    registry.register({
      id: WIDGET_ID,
      defaultAnchor: "bottom-center",
      defaultOffset: { x: OFFSET_X, y: OFFSET_Y },
      defaultScale: 1,
      defaultVisible: true,
    });
    // Registered synchronously above, so this id is always present in the resolved map.
    const layout = registry.resolve(viewport).get(WIDGET_ID)!;
    this.container = createWidgetContainer(scene, layout);
    const chipBg = drawPanelBackground(scene, CHIP_WIDTH, CHIP_HEIGHT).setPosition(-CHIP_WIDTH / 2, -CHIP_HEIGHT);
    this.hitArea = scene.add.rectangle(-CHIP_WIDTH / 2, -CHIP_HEIGHT, CHIP_WIDTH, CHIP_HEIGHT, 0x000000, 0).setOrigin(0, 0);
    const label = scene.add.text(0, -CHIP_HEIGHT / 2, "BAG", uiTextStyle(11)).setOrigin(0.5, 0.5);
    this.container.add([chipBg, this.hitArea, label]);
  }

  /** Screen-space hit test (pointer coords) — the click surface HudWidgets.hitTest reads. */
  hitTest(screenX: number, screenY: number): boolean {
    return this.hitArea.getBounds().contains(screenX, screenY);
  }

  /** Re-resolves this widget's screen position for a new viewport (call on resize). */
  resize(registry: WidgetRegistry, viewport: Viewport): void {
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (layout) syncWidgetContainer(this.container, layout);
  }
}
