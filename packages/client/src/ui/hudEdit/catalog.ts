/**
 * Pure view-model for edit-HUD's catalog side panel: one row per registered widget
 * with its live visibility, independent of Phaser so it round-trips through vitest —
 * mirrors the widgets/hud folder's own render-class/view-model split (e.g. inventoryRows.ts).
 */
import type { WidgetDefinition, WidgetOverride } from "../widgets/state.js";

export interface CatalogRow {
  id: string;
  visible: boolean;
}

/** Sorted by id for a stable, deterministic row order across renders. */
export function buildCatalogRows(
  definitions: readonly WidgetDefinition[],
  overrideFor: (id: string) => WidgetOverride | undefined,
): CatalogRow[] {
  return definitions
    .map((definition) => ({
      id: definition.id,
      visible: overrideFor(definition.id)?.visible ?? definition.defaultVisible,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
