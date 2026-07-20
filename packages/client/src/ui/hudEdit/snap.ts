/**
 * Pure grid-snap and anchor-recompute math for edit-HUD dragging (docs/HUD_OS.md §3
 * "re-docking"): releasing a drag picks the nearest of the registry's 9 anchors and
 * an offset measured from it, so a moved widget survives a viewport resize instead
 * of drifting off a stale absolute position. No Phaser — round-trips through vitest.
 */
import { anchorPoint } from "../widgets/anchors.js";
import type { AnchorId, Offset, Viewport } from "../widgets/state.js";

/** Every drag-drop position snaps to this many px — matches ui/panel.ts's PANEL_SPACING grid. */
export const EDIT_GRID_SIZE = 8;

export function snapToGrid(value: number): number {
  const snapped = Math.round(value / EDIT_GRID_SIZE) * EDIT_GRID_SIZE;
  // Normalizes -0 (e.g. snapping -1 rounds to -0) to plain 0 — a widget offset of
  // "negative zero" is a distinction with no visual meaning, only a footgun for ===/toBe.
  return snapped === 0 ? 0 : snapped;
}

function verticalBand(y: number, height: number): "top" | "center" | "bottom" {
  const fraction = height > 0 ? y / height : 0.5;
  if (fraction < 1 / 3) return "top";
  if (fraction < 2 / 3) return "center";
  return "bottom";
}

function horizontalBand(x: number, width: number): "left" | "center" | "right" {
  const fraction = width > 0 ? x / width : 0.5;
  if (fraction < 1 / 3) return "left";
  if (fraction < 2 / 3) return "center";
  return "right";
}

/** Collapses a vertical/horizontal band pair into one of the 9 AnchorIds — "center"+"center"
 * is bare "center", matching AnchorId's own naming (widgets/state.ts). */
function combineAnchor(vertical: "top" | "center" | "bottom", horizontal: "left" | "center" | "right"): AnchorId {
  if (vertical === "center" && horizontal === "center") return "center";
  return `${vertical}-${horizontal}` as AnchorId;
}

/**
 * The nearest anchor for an absolute screen point, and the grid-snapped offset from
 * that anchor's own base point which reproduces the same on-screen position.
 */
export function recomputeAnchor(point: { x: number; y: number }, viewport: Viewport): { anchor: AnchorId; offset: Offset } {
  const anchor = combineAnchor(verticalBand(point.y, viewport.height), horizontalBand(point.x, viewport.width));
  const base = anchorPoint(anchor, viewport);
  return { anchor, offset: { x: snapToGrid(point.x - base.x), y: snapToGrid(point.y - base.y) } };
}

/**
 * Converts a drag's real on-screen offset (what recomputeAnchor returns, and what the
 * EDIT_GRID_SIZE snap grid is measured in) into the pre-hudScale unit every stored/
 * default widget offset is authored in. `resolveLayout` (widgets/layout.ts) multiplies
 * every stored offset by hudScale on every read — storing an already-scaled value would
 * double the displacement the next time it resolves.
 */
export function toStoredOffset(offset: Offset, hudScale: number): Offset {
  return { x: offset.x / hudScale, y: offset.y / hudScale };
}
