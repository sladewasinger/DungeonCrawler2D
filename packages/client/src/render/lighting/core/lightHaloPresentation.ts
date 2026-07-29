import { LIGHTING_VISUAL_STYLE } from "../lightingVisualStyle.js";
import type { LightSource } from "./lightSource.js";

const DECORATIVE = LIGHTING_VISUAL_STYLE.decorativeLight;

export interface LightHaloPresentation {
  readonly radiusTiles: number;
  readonly alphaMultiplier: number;
  readonly scaleMultiplier: number;
}

/** Keeps elemental and portal colors legible without turning them into area floodlights. */
export function lightHaloPresentation(light: LightSource): LightHaloPresentation {
  const decorative = isDecorativeLight(light);
  return {
    radiusTiles: decorative
      ? Math.min(light.radiusTiles, DECORATIVE.maximumRadiusTiles)
      : light.radiusTiles,
    alphaMultiplier: (light.haloAlphaMultiplier ?? 1) *
      (decorative ? DECORATIVE.haloAlphaMultiplier : 1),
    scaleMultiplier: light.haloScaleMultiplier ?? 1,
  };
}

function isDecorativeLight(light: LightSource): boolean {
  if (light.kind === "torch" || light.emitsTorchLight) return false;
  return light.kind === "fire" || light.kind === "poison" ||
    light.kind === "steam" || light.kind === "portal";
}
