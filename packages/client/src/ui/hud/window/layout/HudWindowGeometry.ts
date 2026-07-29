/** Owns deterministic viewport placement and desktop snapping for HUD windows. */
import type { HudAnchor } from "./HudWindows.js";

const MARGIN = 16;
const SNAP_DISTANCE = 32;
const anchors: Array<Exclude<HudAnchor, "free">> = ["top-left", "top-center", "top-right", "center-left", "center", "center-right", "bottom-left", "bottom-center", "bottom-right"];

export interface HudAnchorPositionInput {
  anchor: HudAnchor;
  size: HudWindowDimensions;
  viewport: HudWindowDimensions;
}

export interface HudWindowDimensions {
  width: number;
  height: number;
}

export interface ClosestHudAnchorInput {
  position: HudWindowPoint;
  size: HudWindowDimensions;
  viewport: HudWindowDimensions;
}

export interface HudWindowPoint {
  x: number;
  y: number;
}

export const anchoredPosition = ({ anchor, size, viewport }: HudAnchorPositionInput): HudWindowPoint => {
  const { width, height } = size;
  const { width: viewportWidth, height: viewportHeight } = viewport;
  const x = anchoredAxisPosition({ anchor, start: "left", end: "right", viewport: viewportWidth, size: width });
  const y = anchoredAxisPosition({ anchor, start: "top", end: "bottom", viewport: viewportHeight, size: height });
  return {
    x: Math.round(Math.min(Math.max(0, x), Math.max(0, viewportWidth - width))),
    y: Math.round(Math.min(Math.max(0, y), Math.max(0, viewportHeight - height))),
  };
};

interface AnchoredAxisInput {
  anchor: HudAnchor;
  start: string;
  end: string;
  viewport: number;
  size: number;
}

const anchoredAxisPosition = ({ anchor, start, end, viewport, size }: AnchoredAxisInput): number => {
  if (anchor.includes(start)) return MARGIN;
  if (anchor.includes(end)) return viewport - size - MARGIN;
  return (viewport - size) / 2;
};

export const closestAnchor = ({ position, size, viewport }: ClosestHudAnchorInput): HudAnchor => {
  let closest: HudAnchor = "free";
  let distance = SNAP_DISTANCE;
  for (const anchor of anchors) {
    const target = anchoredPosition({ anchor, size, viewport });
    const candidate = Math.hypot(target.x - position.x, target.y - position.y);
    if (candidate > distance) continue;
    closest = anchor;
    distance = candidate;
  }
  return closest;
};
