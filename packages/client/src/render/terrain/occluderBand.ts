// Classifies a face column's rows between the dynamic per-row occluder strips and
// the chunk's static base sheet, so tall walls stop inflating every strip's baked
// height (the MAX_FACE_ROWS 3 -> 16 per-frame fill regression). Also resolves which
// container a cell's shifted CAP bakes into (see the section below).
//
// Why a small fixed band is correct (docs/ASSUMPTIONS.md #218 follow-up): an
// occluder strip whose base row is Y sorts in front of exactly the entities whose
// feet sit at worldY <= Y + 1 (depthSort.ts: strip depth = (Y+1)*ROW_STEP + 0.5).
// Entities render lifted by their FULL height z (lift.ts), so such an entity's
// sprite occupies screen rows [feetY - z - spriteTiles, feetY - z]:
//   - Feet ON the face-owning surface means z >= that surface's height, which
//     lifts the sprite strictly above the face's topmost drawn row — no overlap.
//   - Feet NORTH of the wall's footprint reach down into the face's rows only
//     when z < 0 (below the base plane) — and below-base face rows already draw
//     as static base content (drawGroundTile's drawPitFaceCell), by design.
// So the only overlap a strip must depth-resolve is an entity roughly level with
// the face's foot: feet at most 1 row south of the base row, lifted by at most a
// jump apex (~1.1 tiles, JUMP_VELOCITY^2 / 2*GRAVITY), tallest sprite art 2.25
// screen tiles above that. DYNAMIC_FACE_ROWS = 6 covers it with margin. Above
// the band, the only sacrifice is the sub-quarter-tile side-bleed sliver (sprite
// half-width minus BODY_RADIUS) of an elevated entity hugging a much taller
// wall, which now draws over instead of under — accepted, mirroring the
// already-static pit interiors.
import type Phaser from "phaser";

/**
 * Face rows, counted from the face's ground-adjacent bottom row (1-based, the
 * same axis as OwnFaceRow.distanceToGround), that bake into the dynamic
 * occluder strip. Rows further up a tall column bake into the static base
 * sheet: they render identically (all tile art is confined to its own cell)
 * but cost nothing extra per frame.
 */
export const DYNAMIC_FACE_ROWS = 6;

/** True when a face row this far above open ground bakes into the static base sheet. */
export function bakesIntoStaticBase(distanceToGround: number): boolean {
  return distanceToGround > DYNAMIC_FACE_ROWS;
}

/**
 * Tiles above its strip's base row a dynamic face row's art sits (0 = the base
 * row itself). Callers must only ask for rows the band keeps dynamic.
 */
export function stripOverhangTiles(distanceToGround: number): number {
  return distanceToGround - 1;
}

// --- Cap containers (docs/ELEVATION-PROJECTION.md section 2) ---------------
//
// A cell's SURFACE (cap) shifts screen-up by height*TILE — unlike a face BAND,
// which stays at its own raw row and always fits inside its chunk's own tile
// bounds, a shifted cap can bleed above (or, for a negative/pit height, below)
// its cell's row. It can never live in the flat per-chunk base sheet (that RT's
// bounds are exactly the chunk's own tile rect — a shifted sprite outside those
// bounds is silently clipped, THE TOP RISK the spec calls out), so every
// nonzero-height cap goes through its own per-row occluder strip instead, with
// enough overhang to contain the shift, and a depth key placed so an entity
// standing exactly on its own cap always draws in front of it (see
// chunkVisual.ts's makeCapOccluderFor for the depth formula this feeds).
//
// Simplification (docs/ASSUMPTIONS.md row 304): unlike face bands, caps do NOT
// reuse the DYNAMIC_FACE_ROWS static/strip split — every nonzero-height cap
// bakes into a strip regardless of how far its height pushes it from open
// ground, trading a little extra per-chunk bake cost for guaranteed-correct
// cross-chunk ordering (row-scaled depth) on every raised/sunken surface.

/** Tiles a cap must be able to bleed ABOVE its own row (0 for flat/negative height). */
export function capOverhangAbove(height: number): number {
  return Math.max(0, Math.ceil(height));
}

/** Tiles a cap must be able to bleed BELOW its own row's south edge (0 for flat/positive height). */
export function capOverhangBelow(height: number): number {
  return Math.max(0, Math.ceil(-height));
}

/** True when `height` is close enough to zero that its cap never leaves its own row —
 * the fast path straight into the flat static base sheet. */
export function isFlatSurface(height: number): boolean {
  return Math.abs(height) < 0.01;
}

/** Chunk-level accessor for a cell's cap strip: lazily creates/grows the strip keyed
 * to view row `vy`, given how far its content must bleed above/below that row. */
export type CapOccluderFor = (
  vy: number,
  overhangAbove?: number,
  overhangBelow?: number,
) => Phaser.GameObjects.Container;

/** The two height reads the intrusion probe needs — satisfied by the view-space
 * proxy (viewWorld.ts), so "north" below means SCREEN-north at any orientation. */
export interface SurfaceHeightRead {
  heightAt(x: number, y: number): number;
  groundAt(x: number, y: number): number;
}

/** How many screen-north rows the intrusion probe scans — the same drawn-content
 * reach budget as ownFace.ts's MAX_FACE_ROWS / occlusion.ts's
 * MAX_OCCLUDING_ROWS_AHEAD (docs/ASSUMPTIONS.md row 320): no cap shifts, and no
 * occludable sprite reaches, further than this many rows. */
const INTRUSION_SCAN_ROWS = 16;

/** The height a cell's surface actually DRAWS at: the stair-ramp-aware center
 * ground when it differs (a rim-straddle stair draws at (hi+lo)/2), else
 * heightAt. groundAt is non-finite on walls — fall back to heightAt there. */
function drawnSurfaceHeight(world: SurfaceHeightRead, wx: number, wy: number): number {
  const ground = world.groundAt(wx + 0.5, wy + 0.5);
  const height = world.heightAt(wx, wy);
  return Number.isFinite(ground) ? Math.min(ground, height) : height;
}

/**
 * True when DOWN-shifted content from a screen-north cell lands in (or past)
 * this cell's own screen band: a cell `k` rows north drawing at surface height
 * `h` puts its cap band at screen rows starting `(vy - k) - h`, which reaches
 * row `vy` once `h < 1 - k` — and a pit-dweller's sprite reaches even further
 * south, so no lower bound. A flat cell this is true of must bake into its own
 * row-keyed strip: left in the static base sheet it could never draw over the
 * intruding strip or over the down-shifted entity it must cover (spec §1's
 * worked example D — "south rim at screen 13 covers the floor behind it").
 */
export function intrudedFromScreenNorth(world: SurfaceHeightRead, wx: number, vy: number): boolean {
  for (let k = 1; k <= INTRUSION_SCAN_ROWS; k++) {
    if (drawnSurfaceHeight(world, wx, vy - k) < 1 - k) return true;
  }
  return false;
}

/**
 * The container a cell's shifted cap draws into: the flat base sheet when its
 * height is (near enough) zero — the overwhelming majority of tiles, costing
 * nothing extra — otherwise its own per-row cap strip, sized to the shift.
 * A FLAT cell with down-shifted content intruding from screen-north (a pit
 * rim's south lip, the ground south of a rim-straddle stair) also strips, so
 * its row-scaled depth puts it in front of both the intruding terrain and any
 * down-shifted dweller behind it.
 */
export function surfaceContainerFor(
  world: SurfaceHeightRead,
  wx: number,
  vy: number,
  height: number,
  below: Phaser.GameObjects.Container,
  capOccluderFor: CapOccluderFor,
): Phaser.GameObjects.Container {
  if (!isFlatSurface(height)) {
    return capOccluderFor(vy, capOverhangAbove(height), capOverhangBelow(height));
  }
  if (intrudedFromScreenNorth(world, wx, vy)) return capOccluderFor(vy, 0, 0);
  return below;
}
