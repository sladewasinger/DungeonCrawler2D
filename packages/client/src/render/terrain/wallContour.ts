// Classifies each wall cell by its role in the wall mass's contour (3x3-minimal
// autotile convention, per the 0x72 pack README) so every cell draws art matching
// its actual shape: face, rim piece, quiet interior fill, or freestanding pillar.

export type SolidNeighbor = (dx: number, dy: number) => boolean;
export type VerticalBridgeSide = "west" | "east";

export type WallRole =
  | { readonly kind: "pillar" }
  | {
      readonly kind: "face";
      readonly frame: string;
      readonly outline: { readonly north: boolean; readonly west: boolean; readonly east: boolean };
    }
  | { readonly kind: "rim"; readonly art: RimArt }
  | { readonly kind: "fill" };

/** Neighborhood openness snapshot: true = that side is NOT solid wall. */
interface Openness {
  readonly n: boolean;
  readonly s: boolean;
  readonly e: boolean;
  readonly w: boolean;
  readonly ne: boolean;
  readonly nw: boolean;
  readonly se: boolean;
  readonly sw: boolean;
}

function openness(solid: SolidNeighbor): Openness {
  return {
    n: !solid(0, -1),
    s: !solid(0, 1),
    e: !solid(1, 0),
    w: !solid(-1, 0),
    ne: !solid(1, -1),
    nw: !solid(-1, -1),
    se: !solid(1, 1),
    sw: !solid(-1, 1),
  };
}

/** 4-bit orthogonal-openness key: n<<3 | s<<2 | e<<1 | w. */
function orthoKey(o: Openness): number {
  return (o.n ? 8 : 0) | (o.s ? 4 : 0) | (o.e ? 2 : 0) | (o.w ? 1 : 0);
}

/**
 * Rim piece per orthogonal-openness key, following the pack's real art (verified
 * against the kit strip): thin outline pieces sit OVER black fill on mass
 * boundaries; the full-brick side pieces (wall_edge_left/right, wall_left/mid/
 * right) are reserved for 1-tile-thick runs where the wall IS the whole ridge.
 * `flip: true` draws the piece vertically mirrored (bottom edges reuse the top
 * dash art — the kit has no bottom-mid piece). Key 0 (all orthogonals solid)
 * and key 15 (pillar) are handled by the callers.
 */
export interface RimArt {
  readonly frame: string;
  readonly flip?: boolean;
  /** Full-coverage brick art — no fill rect needed beneath it. */
  readonly opaque?: boolean;
  readonly texturedFill?: boolean;
  readonly groundFill?: boolean;
  /** A narrow wall ending above open ground still needs its brick face below the cap. */
  readonly projectedFace?: string;
  readonly capNorth?: boolean;
  readonly capSouth?: boolean;
  readonly capEast?: boolean;
}

const THIN_V_LEFT: RimArt = { frame: "wall_edge_mid_left" };
const THIN_V_RIGHT: RimArt = { frame: "wall_edge_mid_right" };
const RIDGE_V: RimArt = { frame: "wall_edge_mid_left", capEast: true };
const RIDGE_H: RimArt = { frame: "wall_mid", opaque: true, capNorth: true, capSouth: true };

const RIM_BY_KEY: Readonly<Record<number, RimArt>> = {
  1: THIN_V_LEFT,
  2: THIN_V_RIGHT,
  3: RIDGE_V,
  4: { frame: "wall_top_mid" },
  5: { frame: "wall_edge_bottom_left", groundFill: true },
  6: { frame: "wall_edge_bottom_right", groundFill: true },
  7: { ...RIDGE_V, capSouth: true },
  8: { frame: "wall_top_mid", flip: true },
  9: { frame: "wall_edge_top_left", groundFill: true },
  10: { frame: "wall_edge_top_right", groundFill: true },
  11: { ...RIDGE_V, capNorth: true },
  12: RIDGE_H,
  13: { frame: "wall_left", opaque: true },
  14: { frame: "wall_right", opaque: true },
};

/** Concave boundary: every orthogonal is wall and the open diagonal selects the inward-facing corner. */
function insideCornerPiece(o: Openness): RimArt {
  if (o.nw) return { frame: "wall_outer_front_right", groundFill: true };
  if (o.ne) return { frame: "wall_outer_front_left", groundFill: true };
  if (o.sw) return { frame: "wall_outer_top_right", groundFill: true };
  return { frame: "wall_outer_top_left", groundFill: true };
}

function anyDiagonalOpen(o: Openness): boolean {
  return o.ne || o.nw || o.se || o.sw;
}

/** True when this contour cell belongs to a one- or two-cell-wide vertical wall, not a broad wall mass. */
function isNarrowVerticalSurface(solid: SolidNeighbor): boolean {
  const westOpen = !solid(-1, 0);
  const eastOpen = !solid(1, 0);
  if (westOpen && eastOpen) return true;
  if (westOpen) return !solid(2, 0);
  if (eastOpen) return !solid(-2, 0);
  return false;
}

function withSurfaceFill(art: RimArt, solid: SolidNeighbor): RimArt {
  return !art.opaque && !art.groundFill && isNarrowVerticalSurface(solid)
    ? { ...art, texturedFill: true }
    : art;
}

/** Face-run piece: ends pick the left/right face caps, middles the tileable mid. */
function facePiece(solid: SolidNeighbor, isFace: (dx: number) => boolean): string {
  const westFace = solid(-1, 0) && isFace(-1);
  const eastFace = solid(1, 0) && isFace(1);
  if (!westFace && eastFace) return "wall_left";
  if (westFace && !eastFace) return "wall_right";
  return "wall_mid";
}

/**
 * A south-projecting face can visually collide with a one-wide wall resuming
 * two rows below it. Treat the aligned pieces as one vertical T-junction so
 * the projected brick face does not sever the wall silhouette.
 */
export function verticalFaceBridgeSide(
  solid: SolidNeighbor,
  selfIsFace: boolean,
): VerticalBridgeSide | undefined {
  if (!selfIsFace || !solid(0, -1) || solid(0, 1) || !solid(0, 2)) return undefined;
  const west = solid(-1, 0);
  const east = solid(1, 0);
  if (west === east) return undefined;
  return west ? "west" : "east";
}

/**
 * The role a wall cell plays in its mass's contour.
 *
 * @param solid whether the neighbor at (dx, dy) is wall terrain
 * @param selfIsFace whether THIS cell fronts lower open ground to its south — a
 *   HEIGHT decision supplied by the caller (faces.ts), never re-derived from tiles
 * @param isFaceCell face-ness of the horizontal neighbor at offset dx (same row)
 */
export function classifyWallCell(
  solid: SolidNeighbor,
  selfIsFace: boolean,
  isFaceCell: (dx: number) => boolean,
): WallRole {
  const o = openness(solid);
  const key = orthoKey(o);
  if (key === 15) return { kind: "pillar" };
  const rim = RIM_BY_KEY[key];
  if (selfIsFace && solid(0, -1) && rim !== undefined && isNarrowVerticalSurface(solid)) {
    return {
      kind: "rim",
      art: {
        ...withSurfaceFill(rim, solid),
        projectedFace: facePiece(solid, isFaceCell),
      },
    };
  }
  if (selfIsFace) {
    return {
      kind: "face",
      frame: facePiece(solid, isFaceCell),
      outline: { north: o.n, west: o.w, east: o.e },
    };
  }
  if (rim !== undefined) return { kind: "rim", art: withSurfaceFill(rim, solid) };
  if (anyDiagonalOpen(o)) return { kind: "rim", art: withSurfaceFill(insideCornerPiece(o), solid) };
  return { kind: "fill" };
}
