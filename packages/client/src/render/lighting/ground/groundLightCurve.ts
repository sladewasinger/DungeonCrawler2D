import { smoothstep01 } from "@dc2d/engine";
import { LIGHT_CURVE_FULL_LEVEL } from "../../terrain/shading/tileLight.js";

/** Matches terrain light's S-curve: a bright core, then a sharply fading tail. */
export function groundLightStrength(
  distance: number,
  radiusTiles: number,
): number {
  return smoothstep01((radiusTiles - distance) / LIGHT_CURVE_FULL_LEVEL);
}
