/** Resolves each registered widget's on-screen placement for a given viewport. */
import { anchorPoint } from "./anchors.js";
import type { ResolvedWidgetLayout, Viewport, WidgetDefinition, WidgetOverride, WidgetRegistryState } from "./state.js";

/** Merges a widget's shipped default with any config override (override wins per-field). */
export function effectiveWidget(definition: WidgetDefinition, override: WidgetOverride | undefined) {
  return {
    anchor: override?.anchor ?? definition.defaultAnchor,
    offset: override?.offset ?? definition.defaultOffset,
    scale: override?.scale ?? definition.defaultScale,
    visible: override?.visible ?? definition.defaultVisible,
  };
}

/**
 * Resolves every registered widget's screen position for the given viewport, folding in
 * the registry's global hudScale (state.hudScale): the offset is scaled right along with
 * the container so a widget's padding from its anchor grows with its now-bigger content
 * instead of the bigger content overrunning a padding sized for the un-scaled widget.
 */
export function resolveLayout(state: WidgetRegistryState, viewport: Viewport): Map<string, ResolvedWidgetLayout> {
  const resolved = new Map<string, ResolvedWidgetLayout>();
  const { hudScale } = state;
  for (const [id, definition] of state.definitions) {
    const { anchor, offset, scale, visible } = effectiveWidget(definition, state.overrides.get(id));
    const base = anchorPoint(anchor, viewport);
    const x = base.x + offset.x * hudScale;
    const y = base.y + offset.y * hudScale;
    // The monogram pixel font only renders crisp at integer canvas-scale multiples
    // (docs/VISUAL_DIRECTION.md "pixel font everywhere") — round so widget.scale *
    // hudScale always lands on a whole number, even for a future editor's fractional drag-resize.
    const finalScale = Math.round(scale * hudScale);
    resolved.set(id, { anchor, x, y, scale: finalScale, visible });
  }
  return resolved;
}
