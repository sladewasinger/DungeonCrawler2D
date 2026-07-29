import terrainVisualStyle from "./terrainVisualStyle.json" with { type: "json" };
import { hexColorToNumber } from "../style/hexColor.js";

/** Source-of-truth terrain presentation values; colors remain picker-friendly CSS hex. */
export const TERRAIN_VISUAL_STYLE = terrainVisualStyle;

/** Converts a configured CSS hex color at the Phaser Graphics boundary. */
export function phaserColor(hex: string): number {
  return hexColorToNumber(hex, "terrain color");
}
