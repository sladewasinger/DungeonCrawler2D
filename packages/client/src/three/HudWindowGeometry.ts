/** Owns deterministic viewport placement and desktop snapping for HUD windows. */
import type { HudAnchor } from "./HudWindows.js";

const MARGIN = 16;
const SNAP_DISTANCE = 32;
const anchors: Array<Exclude<HudAnchor, "free">> = ["top-left", "top-center", "top-right", "center-left", "center", "center-right", "bottom-left", "bottom-center", "bottom-right"];

export const anchoredPosition = (anchor: HudAnchor, width: number, height: number, viewportWidth: number, viewportHeight: number) => {
  const x = anchor.endsWith("left") ? MARGIN : anchor.endsWith("right") ? viewportWidth - width - MARGIN : (viewportWidth - width) / 2;
  const y = anchor.startsWith("top") ? MARGIN : anchor.startsWith("bottom") ? viewportHeight - height - MARGIN : (viewportHeight - height) / 2;
  return { x: Math.round(x), y: Math.round(y) };
};

export const closestAnchor = (x: number, y: number, width: number, height: number, viewportWidth: number, viewportHeight: number): HudAnchor => {
  let closest: HudAnchor = "free";
  let distance = SNAP_DISTANCE;
  for (const anchor of anchors) {
    const target = anchoredPosition(anchor, width, height, viewportWidth, viewportHeight);
    const candidate = Math.hypot(target.x - x, target.y - y);
    if (candidate > distance) continue;
    closest = anchor;
    distance = candidate;
  }
  return closest;
};
