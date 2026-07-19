// Height → shade: one multiply tint per sprite composes a constant palette grade
// (the pack's warm stone cooled toward VISUAL_DIRECTION's blue-grey) with a height
// factor: floor level slightly dimmed, raised ground at full brightness, pits
// darkening, chasms near-black. Elevation reads from this relative shading plus
// faces/edges/shadows — never from per-tile highlight rectangles (they wallpaper
// the grid, the exact defect this module used to cause).

const LOW_HEIGHT = -1; // a sunken pit floor (1z = 1 tile)
const HIGH_HEIGHT = 1; // a dais / wall-top rise (1z = 1 tile)
const CHASM_THRESHOLD = -1.5; // below this reads as void, not "deep pit"

/** Cools the pack's native warm-brown stone toward the doc's #2e2e3a..#494956 blue-grey. */
const PALETTE_GRADE = 0xa8acc8;
/** Floor-level dim: raised ground renders at full grade, so height reads as relative light. */
const FLOOR_FACTOR = 0xd6d6e0;
const NEUTRAL_FACTOR = 0xffffff;
const PIT_FACTOR = 0x767686;
export const CHASM_TINT = multiplyColor(PALETTE_GRADE, 0x30303c);

/** Flat fill color for solid-rock interior cells — quiet near-black, no texture, no banding. */
export const WALL_FILL_COLOR = 0x0c0c12;

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function lerpColor(a: number, b: number, t: number): number {
  const [ar, ag, ab] = channels(a);
  const [br, bg, bb] = channels(b);
  return (lerpChannel(ar, br, t) << 16) | (lerpChannel(ag, bg, t) << 8) | lerpChannel(ab, bb, t);
}

function channels(c: number): [number, number, number] {
  return [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];
}

/** Composes two multiply tints into the single tint Phaser applies to a sprite. */
function multiplyColor(a: number, b: number): number {
  const [ar, ag, ab] = channels(a);
  const [br, bg, bb] = channels(b);
  const mul = (x: number, y: number) => Math.round((x / 255) * (y / 255) * 255);
  return (mul(ar, br) << 16) | (mul(ag, bg) << 8) | mul(ab, bb);
}

function heightFactor(height: number): number {
  if (height <= CHASM_THRESHOLD) return 0x30303c;
  if (height < 0) return lerpColor(PIT_FACTOR, FLOOR_FACTOR, clamp01((height - LOW_HEIGHT) / -LOW_HEIGHT));
  return lerpColor(FLOOR_FACTOR, NEUTRAL_FACTOR, clamp01(height / HIGH_HEIGHT));
}

/** The multiply-tint a tile's base sprite takes for its terrain height (palette grade + height factor). */
export function heightTint(height: number): number {
  return multiplyColor(PALETTE_GRADE, heightFactor(height));
}

/** Chasm-depth tiles render as the pack's void art instead of a floor variant. */
export function isChasmDepth(height: number): boolean {
  return height <= CHASM_THRESHOLD;
}
