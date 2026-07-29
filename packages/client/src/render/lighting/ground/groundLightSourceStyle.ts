import type { LightSource } from "../core/lightSource.js";
import { LIGHTING_VISUAL_STYLE } from "../lightingVisualStyle.js";

const GROUND = LIGHTING_VISUAL_STYLE.ground;
const DARKNESS = LIGHTING_VISUAL_STYLE.darkness;

export interface GroundLightBrushStyle {
  readonly radiusTiles: number;
  readonly brushRadiusTiles: number;
  readonly brushAlpha: number;
}

export interface GroundLightSourceBrushStyle {
  readonly brushRadiusTiles: number;
  readonly brushAlpha: number;
}

export function broadLightRevealStyle(
  source: Readonly<LightSource>,
): GroundLightBrushStyle {
  return {
    radiusTiles: source.revealRadiusTiles ??
      (source.kind === "personal"
        ? source.radiusTiles
        : DARKNESS.worldRevealRadiusTiles),
    brushRadiusTiles: source.revealCellRadiusTiles ??
      GROUND.torchRevealCellRadiusTiles,
    brushAlpha: source.revealCellAlpha ?? GROUND.torchRevealCellAlpha,
  };
}

export function exactLightRevealStyle(
  source: Readonly<LightSource>,
): GroundLightSourceBrushStyle {
  return {
    brushRadiusTiles: source.sourceRevealCellRadiusTiles ??
      GROUND.torchSourceRevealCellRadiusTiles,
    brushAlpha: source.sourceRevealCellAlpha ??
      GROUND.torchSourceRevealCellAlpha,
  };
}
