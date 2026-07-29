import {
  LIGHTING_VISUAL_STYLE,
  lightingColor,
} from "../lightingVisualStyle.js";

const TORCH_STYLE = LIGHTING_VISUAL_STYLE.torch;

export const TORCH_COLOR = lightingColor(TORCH_STYLE.color);
export const TORCH_RADIUS_TILES = TORCH_STYLE.radiusTiles;
/** A flying torch only gets a plain travel glow — smaller, and never kind "torch"
 * (that would spawn a flame particle chasing the arc; flames are a landed-only cue). */
export const TORCH_FLIGHT_RADIUS_TILES = TORCH_STYLE.flightRadiusTiles;
