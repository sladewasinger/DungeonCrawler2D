/**
 * Phaser container helpers so widgets are positioned only through resolved
 * registry layout — never with a hardcoded `setPosition` elsewhere.
 */
import type Phaser from "phaser";
import type { ResolvedWidgetLayout } from "./state.js";

/** Depth every HUD widget renders at — above world, entities, VFX, and the darkness overlay (300,000). */
export const WIDGET_DEPTH = 500_000;

/** Creates a widget's root container at scroll-factor 0 (screen-space, not world-space), pinned above the world. */
export function createWidgetContainer(scene: Phaser.Scene, layout: ResolvedWidgetLayout): Phaser.GameObjects.Container {
  const container = scene.add.container(layout.x, layout.y);
  container.setScrollFactor(0);
  container.setDepth(WIDGET_DEPTH);
  syncWidgetContainer(container, layout);
  return container;
}

/**
 * Applies a freshly-resolved layout to an existing widget container (call once per
 * resize/edit). `layout.scale` already folds in the registry's global hudScale
 * (ui/widgets/layout.ts's resolveLayout) — callers never multiply it again.
 */
export function syncWidgetContainer(container: Phaser.GameObjects.Container, layout: ResolvedWidgetLayout): void {
  container.setPosition(layout.x, layout.y);
  container.setScale(layout.scale);
  container.setVisible(layout.visible);
}
