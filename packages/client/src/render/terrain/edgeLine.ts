// Generic boundary-line overlay: a thin flat-colored band on one side of a tile.
// Replaces the retired 0x72 wall_edge_*/wall_top_mid sprites for every "this
// surface's silhouette needs a seam here" cue (ledge tops, run ends, wall rim
// caps) — pack-agnostic, so it draws identically over any of the 7 packs.
import type Phaser from "phaser";
import { placeFractionalRect } from "./placeSprite.js";

export type EdgeSide = "north" | "south" | "east" | "west";

/** Fraction of a tile's width/height the line band covers. */
const LINE_THICKNESS_FRAC = 0.12;

/** Draws a thin `color` band along one edge of tile (wx, wy) at `alpha`. */
export function drawEdgeLine(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  wx: number,
  wy: number,
  side: EdgeSide,
  color: number,
  alpha = 1,
): void {
  const t = LINE_THICKNESS_FRAC;
  switch (side) {
    case "north":
      placeFractionalRect(scene, container, wx, wy, [0, 1], [0, t], color, alpha);
      return;
    case "south":
      placeFractionalRect(scene, container, wx, wy, [0, 1], [1 - t, 1], color, alpha);
      return;
    case "west":
      placeFractionalRect(scene, container, wx, wy, [0, t], [0, 1], color, alpha);
      return;
    case "east":
      placeFractionalRect(scene, container, wx, wy, [1 - t, 1], [0, 1], color, alpha);
      return;
  }
}

/** Alpha for a face run-end seam: a quiet mortar-toned line (the row's own tint), not a
 * bright rim — distinct from topEdgesAt's ledge highlight (drawTopEdges' TOP_EDGE alpha). */
const SEAM_ALPHA = 0.35;

/**
 * The seam between a face-run cell and whatever's beside it (open ground, wall
 * interior, void): a thin line in the row's OWN tint on each side that doesn't
 * connect to another face row at this exact row, so the run's column never
 * bleeds into its neighbor. Shared by raised faces (drawTile.ts) and pit-interior
 * faces (drawGroundTile.ts) — same run-piece shape, same seam treatment.
 */
export function drawFaceRunSeam(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  wx: number,
  wy: number,
  closeWest: boolean,
  closeEast: boolean,
  tint: number,
): void {
  if (closeWest) drawEdgeLine(scene, container, wx, wy, "west", tint, SEAM_ALPHA);
  if (closeEast) drawEdgeLine(scene, container, wx, wy, "east", tint, SEAM_ALPHA);
}
