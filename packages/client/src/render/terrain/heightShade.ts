// Height → shade: one multiply tint per sprite composes a constant palette grade
// (the pack's warm stone cooled toward VISUAL_DIRECTION's blue-grey) with a height
// factor: floor level slightly dimmed, raised ground stepping brighter PER TIER
// (z0/z1/z2 each a distinct, at-a-glance step — not one flat "raised" plateau,
// the "single walls"/floating-strip legibility bug: a 2-deep z1 ridge's own top
// row used to render identical to plain z0 floor once both hit the same
// brightness clamp), pits darkening, chasms near-black. Elevation reads from
// this relative shading plus faces/edges/shadows — never from per-tile
// highlight rectangles (they wallpaper the grid, the exact defect this module
// used to cause).

const LOW_HEIGHT = -1; // a sunken pit floor (1z = 1 tile)
const CHASM_THRESHOLD = -1.5; // below this reads as void, not "deep pit"

/** Cools the pack's native warm-brown stone toward the doc's #2e2e3a..#494956 blue-grey. */
const PALETTE_GRADE = 0xb0b0b0;
/** Floor-level dim: raised ground steps brighter per tier, so height reads as relative light. */
const FLOOR_FACTOR = 0xd8d8d8;
/** z1 (one tile-edge up: a dais, a ramp landing, a ridge top) — a real step up from floor, short of full white so z2 still has headroom to read brighter. */
const TIER1_FACTOR = 0xeaeaea;
/** z2 and above clamp here: multiply tint can't exceed the sprite's own pixels, so this is the brightness ceiling every higher tier (the collapsed tower's z3 peak included) shares. */
const NEUTRAL_FACTOR = 0xffffff;
// Pit-floor darkening. Was 0x767686 — every prior brightness-demand round
// (docs/ROADMAP.md, "brightness round 1..4") only touched tileLight.ts's
// AMBIENT floor, never this sibling darkening factor, so an ordinary sunken
// PIT room (real Floor tiles, real walkable depth — not a chasm/void) ended
// up crushed toward near-black at anything short of point-blank torch light:
// the user's "pitch black room" repro (austin-dungeon-prod-1, x-13,y18) is
// exactly this — a legible, walkable -1 pit reading as an unrendered hole.
// Lifted to stay visibly darker than floor (still reads as sunken) without
// crushing readability the same way the chasm hole sprite's own factor
// (CHASM_FACTOR, below) was tuned not to.
const PIT_FACTOR = 0x9a9a9a;
// Multiply factor for chasm-depth ground tiles (the "hole" sprite). Tuned so
// the result reads as VISUAL_DIRECTION's "near-black #14141c void" on
// AVERAGE while keeping the sprite's own cave-mouth shading visible: the
// previous 0x30303c crushed the hole art's already-dark palette (RGB
// 34..119) down to single-digit channel values indistinguishable from flat
// black — a void with real texture rendering as a pure black square, the
// pre-deploy "chasm renders pure near-black, no texture" bug. This factor's
// darkest sprite pixel lands near #0a0a0e; the lit rim near #232329 — dark,
// but no longer flat.
const CHASM_FACTOR = 0x707070;
export const CHASM_TINT = multiplyColor(PALETTE_GRADE, CHASM_FACTOR);
/** Flat, unlit purple for every non-walkable void surface and its exposed underlay. */
export const VOID_SURFACE_COLOR = 0x202036;
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
  if (height < 1) return lerpColor(FLOOR_FACTOR, TIER1_FACTOR, clamp01(height));
  return lerpColor(TIER1_FACTOR, NEUTRAL_FACTOR, clamp01(height - 1));
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

/** How far toward full white a top's edge-outline sprite lifts, relative to its own fill tint. */
const TOP_EDGE_SEAM_LIFT = 0.32;

/**
 * The tint for a walkable top's edge-outline bands (drawGroundTile's
 * drawTopEdges via cliffMask.ts): the SAME per-tier heightTint, lifted
 * toward white by a fixed fraction, so the boundary always reads as a
 * lit rim seam distinctly brighter than its own tile's fill — the second
 * half of the raised-top legibility fix (docs/ROADMAP.md's "single walls"
 * complaint), independent of which tier the top itself sits at.
 */
export function topEdgeHighlightTint(height: number): number {
  return lerpColor(heightTint(height), NEUTRAL_FACTOR, TOP_EDGE_SEAM_LIFT);
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
