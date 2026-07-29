const HEX_COLOR = /^#[\da-f]{6}$/i;

/** Converts a picker-friendly CSS hex color at the Phaser numeric-color boundary. */
export function hexColorToNumber(hex: string, label: string): number {
  if (!HEX_COLOR.test(hex)) throw new Error(`Invalid ${label}: ${hex}`);
  return Number.parseInt(hex.slice(1), 16);
}
