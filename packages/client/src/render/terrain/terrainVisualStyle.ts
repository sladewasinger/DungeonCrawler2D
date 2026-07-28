import terrainVisualStyle from "./terrainVisualStyle.json" with { type: "json" };

const HEX_COLOR = /^#[\da-f]{6}$/i;

/** Source-of-truth terrain presentation values; colors remain picker-friendly CSS hex. */
export const TERRAIN_VISUAL_STYLE = terrainVisualStyle;

/** Converts a configured CSS hex color at the Phaser Graphics boundary. */
export function phaserColor(hex: string): number {
  if (!HEX_COLOR.test(hex)) throw new Error(`Invalid terrain color: ${hex}`);
  return Number.parseInt(hex.slice(1), 16);
}
