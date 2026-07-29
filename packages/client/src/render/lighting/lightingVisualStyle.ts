import { hexColorToNumber } from "../style/hexColor.js";
import lightingVisualStyle from "./lightingVisualStyle.json" with { type: "json" };

/** Source-of-truth controls for dynamic terrain, portal, personal, and torch lighting. */
export const LIGHTING_VISUAL_STYLE = lightingVisualStyle;

export function lightingColor(hex: string): number {
  return hexColorToNumber(hex, "lighting color");
}
