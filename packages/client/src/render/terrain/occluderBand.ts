// Classifies a face column's rows between the dynamic per-row occluder strips and
// the chunk's static base sheet, so tall walls stop inflating every strip's baked
// height (the MAX_FACE_ROWS 3 -> 16 per-frame fill regression).
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
