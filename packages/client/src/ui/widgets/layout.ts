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

/** Resolves every registered widget's screen position for the given viewport. */
export function resolveLayout(state: WidgetRegistryState, viewport: Viewport): Map<string, ResolvedWidgetLayout> {
  const resolved = new Map<string, ResolvedWidgetLayout>();
  for (const [id, definition] of state.definitions) {
    const { anchor, offset, scale, visible } = effectiveWidget(definition, state.overrides.get(id));
    const base = anchorPoint(anchor, viewport);
    resolved.set(id, { anchor, x: base.x + offset.x, y: base.y + offset.y, scale, visible });
  }
  return resolved;
}
