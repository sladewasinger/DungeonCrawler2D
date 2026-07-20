/** Equipped-weapon chip HUD widget: icon + weapon name, docked near the hotbar. */
import type Phaser from "phaser";
import { uiTextStyle } from "../../font.js";
import { drawPanelBackground, spacing } from "../../panel.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";
import { createItemIcon } from "./itemIcon.js";

const WIDGET_ID = "weapon";
const CHIP_WIDTH = 128;
const CHIP_HEIGHT = 40;
const ICON_SIZE = 32;

const WEAPON_NAMES: Readonly<Record<string, string>> = {
  knife: "Knife",
  sword: "Rusty Sword",
  hammer: "Heavy Hammer",
};

export class WeaponChipWidget {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly label: Phaser.GameObjects.Text;
  private readonly scale: number;
  private icon: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene, registry: WidgetRegistry, viewport: Viewport) {
    this.scene = scene;
    registry.register({
      id: WIDGET_ID,
      defaultAnchor: "bottom-right",
      defaultOffset: { x: -16, y: -16 },
      defaultScale: 1,
      defaultVisible: true,
    });
    // Registered synchronously above, so this id is always present in the resolved map.
    const layout = registry.resolve(viewport).get(WIDGET_ID)!;
    this.scale = layout.scale;
    this.container = createWidgetContainer(scene, layout);
    const bg = drawPanelBackground(scene, CHIP_WIDTH, CHIP_HEIGHT).setPosition(-CHIP_WIDTH, -CHIP_HEIGHT);
    this.label = scene.add
      .text(-CHIP_WIDTH + ICON_SIZE + spacing(2), -CHIP_HEIGHT / 2, "", uiTextStyle(12, undefined, layout.scale, "emphasis"))
      .setOrigin(0, 0.5);
    this.container.add([bg, this.label]);
  }

  update(weaponId: string | null): void {
    this.icon?.destroy();
    this.icon = null;
    if (!weaponId) {
      this.label.setText("Unarmed");
      return;
    }
    this.icon = createItemIcon(this.scene, weaponId, ICON_SIZE, this.scale).setPosition(
      -CHIP_WIDTH + spacing(1) + ICON_SIZE / 2,
      -CHIP_HEIGHT / 2,
    );
    this.container.add(this.icon);
    this.label.setText(WEAPON_NAMES[weaponId] ?? weaponId);
  }

  /** Re-resolves this widget's screen position for a new viewport (call on resize). */
  resize(registry: WidgetRegistry, viewport: Viewport): void {
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (layout) syncWidgetContainer(this.container, layout);
  }
}
