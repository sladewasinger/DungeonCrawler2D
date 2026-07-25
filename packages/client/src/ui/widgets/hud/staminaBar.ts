/** Compact stamina/block-state meter used by the Phaser HUD surface. */
import type Phaser from "phaser";
import { uiTextStyle } from "../../font.js";
import { PANEL_BORDER, PANEL_FILL, spacing } from "../../panel.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";

const WIDGET_ID = "stamina";
const TRACK_WIDTH = 176;
const TRACK_HEIGHT = 9;
const STAMINA_COLOR = 0x59b5a8;
const BLOCKING_COLOR = 0x8fcbdc;

export function staminaBarView(
  stamina: number,
  maxStamina: number,
  blocking: boolean,
) {
  const safeStamina = Math.max(0, stamina);
  const ratio = maxStamina > 0
    ? Math.max(0, Math.min(1, safeStamina / maxStamina))
    : 0;
  return {
    ratio,
    color: blocking ? BLOCKING_COLOR : STAMINA_COLOR,
    label: blocking
      ? `BLOCKING · ${Math.ceil(safeStamina)}`
      : `STAMINA ${Math.ceil(safeStamina)} / ${maxStamina}`,
  };
}

export class StaminaBarWidget {
  private readonly container: Phaser.GameObjects.Container;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, registry: WidgetRegistry, viewport: Viewport) {
    registry.register({
      id: WIDGET_ID,
      defaultAnchor: "top-left",
      defaultOffset: { x: 16, y: 48 },
      defaultScale: 1,
      defaultVisible: true,
    });
    const layout = registry.resolve(viewport).get(WIDGET_ID)!;
    this.container = createWidgetContainer(scene, layout);
    const track = scene.add.rectangle(
      0,
      0,
      TRACK_WIDTH + spacing(1),
      TRACK_HEIGHT + spacing(1),
      PANEL_FILL,
    ).setOrigin(0, 0).setStrokeStyle(1, PANEL_BORDER);
    this.fill = scene.add.rectangle(
      spacing(0.5),
      spacing(0.5),
      TRACK_WIDTH,
      TRACK_HEIGHT,
      STAMINA_COLOR,
    ).setOrigin(0, 0);
    this.label = scene.add.text(
      0,
      TRACK_HEIGHT + spacing(1.2),
      "",
      uiTextStyle(9, undefined, layout.scale),
    ).setOrigin(0, 0);
    this.container.add([track, this.fill, this.label]);
  }

  update(stamina: number, maxStamina: number, blocking: boolean): void {
    const view = staminaBarView(stamina, maxStamina, blocking);
    this.fill.setDisplaySize(TRACK_WIDTH * view.ratio, TRACK_HEIGHT);
    this.fill.setFillStyle(view.color);
    this.label.setText(view.label);
  }

  resize(registry: WidgetRegistry, viewport: Viewport): void {
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (layout) syncWidgetContainer(this.container, layout);
  }
}
