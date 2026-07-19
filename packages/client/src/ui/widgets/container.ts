/**
 * Phaser container helpers so widgets are positioned only through resolved
 * registry layout — never with a hardcoded `setPosition` elsewhere.
 */
import type Phaser from "phaser";
import type { ResolvedWidgetLayout } from "./state.js";

/** Creates a widget's root container at scroll-factor 0 (screen-space, not world-space). */
export function createWidgetContainer(scene: Phaser.Scene, layout: ResolvedWidgetLayout): Phaser.GameObjects.Container {
  const container = scene.add.container(layout.x, layout.y);
  container.setScrollFactor(0);
  syncWidgetContainer(container, layout);
  return container;
}

/** Applies a freshly-resolved layout to an existing widget container (call once per resize/edit). */
export function syncWidgetContainer(container: Phaser.GameObjects.Container, layout: ResolvedWidgetLayout): void {
  container.setPosition(layout.x, layout.y);
  container.setScale(layout.scale);
  container.setVisible(layout.visible);
}
