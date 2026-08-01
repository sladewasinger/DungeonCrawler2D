import type { LayoutConfig, WidgetOverride } from "../../state.js";
import tuning from "./touchControlLayout.json" with { type: "json" };

const LEGACY_ID = "touch-buttons";
const LEGACY_OFFSET = { x: -12, y: -40 };
const ACTION_IDS = ["touch-attack", "touch-block", "touch-jump", "touch-interact", "touch-throw"] as const;

/** Carries an old movable button-cluster placement forward to each new independent action. */
export function migrateTouchButtonCluster(config: LayoutConfig): LayoutConfig {
  const legacy = config.widgets[LEGACY_ID];
  if (!legacy || ACTION_IDS.some((id) => config.widgets[id])) return config;
  const widgets = { ...config.widgets };
  for (const id of ACTION_IDS) widgets[id] = migratedActionOverride(legacy, tuning.defaults[id].offset);
  delete widgets[LEGACY_ID];
  return { ...config, widgets };
}

function migratedActionOverride(legacy: WidgetOverride, defaultOffset: { x: number; y: number }): WidgetOverride {
  const offset = legacy.offset
    ? { x: defaultOffset.x + legacy.offset.x - LEGACY_OFFSET.x, y: defaultOffset.y + legacy.offset.y - LEGACY_OFFSET.y }
    : defaultOffset;
  return { ...(legacy.anchor ? { anchor: legacy.anchor } : {}), ...(legacy.scale !== undefined ? { scale: legacy.scale } : {}), ...(legacy.visible !== undefined ? { visible: legacy.visible } : {}), offset };
}
