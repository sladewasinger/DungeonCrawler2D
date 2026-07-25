import type Phaser from "phaser";
import { uiTextStyle } from "../../font.js";
import { PANEL_BORDER, PANEL_FILL, SELECTION_ACCENT } from "../../panel.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";

const WIDGET_ID = "touch-sprint";
const SIZE = 44;
const REST_ALPHA = 0.45;

export class TouchSprintWidget {
  private readonly container: Phaser.GameObjects.Container;
  private readonly cell: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, registry: WidgetRegistry, viewport: Viewport) {
    registry.register({
      id: WIDGET_ID,
      defaultAnchor: "bottom-left",
      defaultOffset: { x: 26, y: -68 },
      defaultScale: 1,
      defaultVisible: true,
    });
    const layout = registry.resolve(viewport).get(WIDGET_ID)!;
    this.container = createWidgetContainer(scene, layout);
    this.cell = scene.add.circle(0, 0, SIZE / 2, PANEL_FILL, REST_ALPHA)
      .setStrokeStyle(1, PANEL_BORDER);
    const label = scene.add.text(0, 0, "RUN", uiTextStyle(9, undefined, layout.scale))
      .setOrigin(0.5);
    this.container.add([this.cell, label]);
  }

  hitTest(screenX: number, screenY: number): boolean {
    return this.cell.getBounds().contains(screenX, screenY);
  }

  update(pressed: boolean): void {
    this.cell.setFillStyle(pressed ? SELECTION_ACCENT : PANEL_FILL, pressed ? 1 : REST_ALPHA);
  }

  resize(registry: WidgetRegistry, viewport: Viewport): void {
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (layout) syncWidgetContainer(this.container, layout);
  }
}
