/**
 * Hotbar HUD widget: 9 slots showing real item atlas sprites + stack counts + keybind
 * glyphs, a gold accent on the selected slot, and a pulsing gold outline while a
 * throwable is armed (docs/VISUAL_DIRECTION.md's panel language).
 */
import type Phaser from "phaser";
import { uiTextStyle } from "../../font.js";
import { drawSelectionAccent, PANEL_BORDER, PANEL_FILL, drawPanelBackground, spacing } from "../../panel.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";
import type { HotbarSlotData } from "./fakeData.js";
import { hotbarSlotViews, HOTBAR_SLOT_COUNT, type HotbarSlotView } from "./hotbarSlots.js";
import { createItemIcon } from "./itemIcon.js";

const WIDGET_ID = "hotbar";
const SLOT_SIZE = 40;
const SLOT_GAP = 4;
const ARMED_PULSE_MS = 500;

interface SlotVisual {
  index: number;
  x: number;
  y: number;
  cell: Phaser.GameObjects.Rectangle;
  accent: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Container | null;
  count: Phaser.GameObjects.Text;
}

export class HotbarWidget {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly slots: SlotVisual[] = [];

  constructor(scene: Phaser.Scene, registry: WidgetRegistry, viewport: Viewport) {
    this.scene = scene;
    registry.register({
      id: WIDGET_ID,
      defaultAnchor: "bottom-center",
      defaultOffset: { x: 0, y: -16 },
      defaultScale: 1,
      defaultVisible: true,
    });
    // Registered synchronously above, so this id is always present in the resolved map.
    const layout = registry.resolve(viewport).get(WIDGET_ID)!;
    this.container = createWidgetContainer(scene, layout);

    const totalWidth = HOTBAR_SLOT_COUNT * SLOT_SIZE + (HOTBAR_SLOT_COUNT - 1) * SLOT_GAP + spacing(1);
    const totalHeight = SLOT_SIZE + spacing(1);
    const bg = drawPanelBackground(scene, totalWidth, totalHeight).setPosition(-totalWidth / 2, -totalHeight);
    this.container.add(bg);
    for (let i = 0; i < HOTBAR_SLOT_COUNT; i++) this.slots.push(this.buildSlot(i, totalWidth, totalHeight));
  }

  private buildSlot(index: number, totalWidth: number, totalHeight: number): SlotVisual {
    const x = -totalWidth / 2 + spacing(0.5) + index * (SLOT_SIZE + SLOT_GAP);
    const y = -totalHeight + spacing(0.5);
    const cell = this.scene.add.rectangle(x, y, SLOT_SIZE, SLOT_SIZE, PANEL_FILL).setOrigin(0, 0).setStrokeStyle(1, PANEL_BORDER);
    const accent = drawSelectionAccent(this.scene, SLOT_SIZE, SLOT_SIZE).setPosition(x, y).setVisible(false);
    const count = this.scene.add
      .text(x + SLOT_SIZE - 3, y + SLOT_SIZE - 3, "", uiTextStyle(11))
      .setOrigin(1, 1);
    const keybind = this.scene.add
      .text(x + 2, y + 1, String(index + 1), uiTextStyle(9, "#8f8fa3"))
      .setOrigin(0, 0);
    this.container.add([cell, accent, count, keybind]);
    return { index, x: x + SLOT_SIZE / 2, y: y + SLOT_SIZE / 2, cell, accent, icon: null, count };
  }

  /** Screen-space hit test (pointer coords) against each slot's cell bounds — the click surface InputHud.hitTest reads. */
  hitTestSlot(screenX: number, screenY: number): number | null {
    for (const slot of this.slots) {
      if (slot.cell.getBounds().contains(screenX, screenY)) return slot.index;
    }
    return null;
  }

  update(slotsData: HotbarSlotData[], selectedSlot: number, armedThrowableSlot: number | null, nowMs: number): void {
    const views = hotbarSlotViews(slotsData, selectedSlot, armedThrowableSlot);
    for (const view of views) {
      const visual = this.slots[view.index];
      if (visual) this.applySlot(view, visual, nowMs);
    }
  }

  private applySlot(view: HotbarSlotView, visual: SlotVisual, nowMs: number): void {
    visual.icon?.destroy();
    visual.icon = null;
    if (view.itemId) {
      visual.icon = createItemIcon(this.scene, view.itemId, SLOT_SIZE).setPosition(visual.x, visual.y);
      this.container.add(visual.icon);
    }
    visual.count.setText(view.count > 1 ? String(view.count) : "");
    const armedPulse = view.armed && Math.floor(nowMs / ARMED_PULSE_MS) % 2 === 0;
    visual.accent.setVisible(view.selected || armedPulse);
  }

  /** Re-resolves this widget's screen position for a new viewport (call on resize). */
  resize(registry: WidgetRegistry, viewport: Viewport): void {
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (layout) syncWidgetContainer(this.container, layout);
  }
}
