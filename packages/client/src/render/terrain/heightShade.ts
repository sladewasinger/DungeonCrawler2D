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
// Multiply factor for chasm-depth ground tiles (the "hole" sprite). Tuned so
// the result reads as VISUAL_DIRECTION's "near-black #14141c void" on
// AVERAGE while keeping the sprite's own cave-mouth shading visible: the
// previous 0x30303c crushed the hole art's already-dark palette (RGB
// 34..119) down to single-digit channel values indistinguishable from flat
// black — a void with real texture rendering as a pure black square, the
// pre-deploy "chasm renders pure near-black, no texture" bug. This factor's
// darkest sprite pixel lands near #0a0a0e; the lit rim near #232329 — dark,
// but no longer flat.
const CHASM_FACTOR = 0x726f86;
export const CHASM_TINT = multiplyColor(PALETTE_GRADE, CHASM_FACTOR);

/** Flat fill color for solid-rock interior cells — quiet near-black, no texture, no banding (VISUAL_DIRECTION: "deep solid rock is near-black mass, not wallpapered face texture" — unlike the hole sprite above, a wall's fill deliberately has none to begin with). */
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
  if (height <= CHASM_THRESHOLD) return CHASM_FACTOR;
  if (height < 0) return lerpColor(PIT_FACTOR, FLOOR_FACTOR, clamp01((height - LOW_HEIGHT) / -LOW_HEIGHT));
  return lerpColor(FLOOR_FACTOR, NEUTRAL_FACTOR, clamp01(height / HIGH_HEIGHT));
}

/** Channel-wise multiply of two tints — shared by every layer that stacks shading. */
export function multiplyTint(a: number, b: number): number {
  return multiplyColor(a, b);
}

/** The multiply-tint a tile's base sprite takes for its terrain height (palette grade + height factor). */
export function heightTint(height: number): number {
  return multiplyColor(PALETTE_GRADE, heightFactor(height));
}

/** Chasm-depth tiles render as the pack's void art instead of a floor variant. */
export function isChasmDepth(height: number): boolean {
  return height <= CHASM_THRESHOLD;
}

/**
 * Multiply shade per face row from its top (1) downward. Kept barely-there
 * (near-white throughout) so a tall face reads as ONE material with the
 * faintest depth cue — depth comes from row structure and boundary lines, not
 * from crushing rows toward black. Tune by editing these two constants.
 */
const FACE_ROW_SHADE = [0xffffff, 0xe6e6ec, 0xd2d2da] as const;
const TRUNCATED_ROW_SHADE = 0x8a8a94;

/** The shade a face row multiplies in — truncated rows (the clipped far end of a deep face) fade darkest. */
export function faceRowShade(rowFromTop: number, truncated: boolean): number {
  if (truncated) return TRUNCATED_ROW_SHADE;
  return FACE_ROW_SHADE[rowFromTop - 1] ?? TRUNCATED_ROW_SHADE;
}
