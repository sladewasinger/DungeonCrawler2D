/**
 * Merges a persisted layout over the shipped default layout, per widget id and per
 * field (docs/HUD_OS.md Phase 2): a widget the user never touched still resolves to
 * whatever default-layout.json ships for it — so a new default widget added after a
 * user's last save isn't silently dropped by their old blob — while a widget the
 * user edited keeps their saved fields, falling back to the shipped fields for
 * anything they didn't touch (e.g. a saved `{visible:false}` still inherits the
 * shipped anchor/offset). Pure — no localStorage/registry access here.
 */
import type { LayoutConfig, WidgetOverride } from "./state.js";

export function mergeLayoutConfigs(defaults: LayoutConfig, saved: LayoutConfig): LayoutConfig {
  const ids = new Set([...Object.keys(defaults.widgets), ...Object.keys(saved.widgets)]);
  const widgets: Record<string, WidgetOverride> = {};
  for (const id of ids) {
    widgets[id] = { ...defaults.widgets[id], ...saved.widgets[id] };
  }
  const hudScale = saved.hudScale ?? defaults.hudScale;
  // exactOptionalPropertyTypes forbids `hudScale: undefined` — the key must be absent, not nulled out.
  return hudScale === undefined ? { version: 1, widgets } : { version: 1, hudScale, widgets };
}
