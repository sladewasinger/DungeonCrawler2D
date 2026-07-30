import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";
import { TOON_LIGHTING_TUNING } from "./toonLightingTuning.js";
import type { ToonWorldBounds } from "./toonVisibilityField.js";

export interface ToonVisibilityCacheKey {
  readonly playerX: number;
  readonly playerY: number;
  readonly orientation: ViewOrientation;
  readonly tileRevision: number;
  readonly bounds: ToonWorldBounds;
}

export function toonVisibilityCacheKey(input: {
  readonly player: Readonly<{ x: number; y: number }>;
  readonly orientation: ViewOrientation;
  readonly tileRevision: number;
  readonly bounds: ToonWorldBounds;
}): ToonVisibilityCacheKey {
  return {
    playerX: quantizePlayerPosition(input.player.x),
    playerY: quantizePlayerPosition(input.player.y),
    orientation: input.orientation,
    tileRevision: input.tileRevision,
    bounds: quantizeBounds(input.bounds),
  };
}

export function shouldRebuildToonVisibility(
  previous: ToonVisibilityCacheKey | null,
  next: ToonVisibilityCacheKey,
): boolean {
  if (!previous) return true;
  return previous.playerX !== next.playerX ||
    previous.playerY !== next.playerY ||
    previous.orientation !== next.orientation ||
    previous.tileRevision !== next.tileRevision ||
    !sameBounds(previous.bounds, next.bounds);
}

function quantizePlayerPosition(position: number): number {
  const step = TOON_LIGHTING_TUNING.playerPositionStepTiles;
  return Math.floor(position / step) * step;
}

function quantizeBounds(bounds: ToonWorldBounds): ToonWorldBounds {
  return {
    x: Math.floor(bounds.x),
    y: Math.floor(bounds.y),
    width: Math.ceil(bounds.width),
    height: Math.ceil(bounds.height),
  };
}

function sameBounds(
  left: ToonWorldBounds,
  right: ToonWorldBounds,
): boolean {
  return left.x === right.x && left.y === right.y &&
    left.width === right.width && left.height === right.height;
}
