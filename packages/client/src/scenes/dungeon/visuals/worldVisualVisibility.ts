import type { WorldPresentationVisibility } from "../../../render/visibility/worldPresentationVisibility.js";

export interface WorldVisualTarget {
  readonly x: number;
  readonly y: number;
  readonly isSelf?: boolean;
}

/** Self feedback remains useful even when the active Toon mask does not include the player. */
export function shouldPresentWorldVisual(
  target: WorldVisualTarget,
  visibility: WorldPresentationVisibility | null | undefined,
): boolean {
  if (target.isSelf || !visibility) return true;
  return visibility.isWorldPositionVisible(target.x, target.y);
}
