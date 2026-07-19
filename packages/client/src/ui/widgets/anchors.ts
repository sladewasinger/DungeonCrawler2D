/** Pure anchor-id → screen-point resolution against a viewport size. */
import type { AnchorId, Viewport } from "./state.js";

const HORIZONTAL: Record<AnchorId, number> = {
  "top-left": 0,
  "center-left": 0,
  "bottom-left": 0,
  "top-center": 0.5,
  center: 0.5,
  "bottom-center": 0.5,
  "top-right": 1,
  "center-right": 1,
  "bottom-right": 1,
};

const VERTICAL: Record<AnchorId, number> = {
  "top-left": 0,
  "top-center": 0,
  "top-right": 0,
  "center-left": 0.5,
  center: 0.5,
  "center-right": 0.5,
  "bottom-left": 1,
  "bottom-center": 1,
  "bottom-right": 1,
};

/** The anchor's base screen point before a widget's own offset is applied. */
export function anchorPoint(anchor: AnchorId, viewport: Viewport): { x: number; y: number } {
  return { x: viewport.width * HORIZONTAL[anchor], y: viewport.height * VERTICAL[anchor] };
}
