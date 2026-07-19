/**
 * Death/downed overlay HUD widget: a dark vignette + centered respawn text, hidden
 * unless the player is downed. Sized to the viewport, but still registry-anchored at
 * "center" so its screen coverage stays a resolved layout, not a hardcoded rect.
 */
import type Phaser from "phaser";
import { pixelTextStyle } from "../../font.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";

const WIDGET_ID = "death";
const VIGNETTE_COLOR = 0x0a0a10;
const VIGNETTE_ALPHA = 0.72;
const RESPAWN_TEXT = "YOU DIED\nrespawning...";

export class DeathOverlayWidget {
  private readonly container: Phaser.GameObjects.Container;
  private readonly vignette: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, registry: WidgetRegistry, viewport: Viewport) {
    registry.register({
      id: WIDGET_ID,
      defaultAnchor: "center",
      defaultOffset: { x: 0, y: 0 },
      defaultScale: 1,
      defaultVisible: true,
    });
    // Registered synchronously above, so this id is always present in the resolved map.
    const layout = registry.resolve(viewport).get(WIDGET_ID)!;
    this.container = createWidgetContainer(scene, layout);
    this.vignette = scene.add.rectangle(0, 0, viewport.width, viewport.height, VIGNETTE_COLOR, VIGNETTE_ALPHA);
    const text = scene.add
      .text(0, 0, RESPAWN_TEXT, pixelTextStyle(20, "#e04a4a"))
      .setOrigin(0.5, 0.5)
      .setAlign("center");
    this.container.add([this.vignette, text]);
    this.container.setVisible(false);
  }

  update(downed: boolean): void {
    this.container.setVisible(downed);
  }

  /** Resizes the vignette to cover the new viewport, then re-syncs the container position. */
  resize(registry: WidgetRegistry, viewport: Viewport): void {
    this.vignette.setSize(viewport.width, viewport.height);
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (layout) syncWidgetContainer(this.container, layout);
  }
}
