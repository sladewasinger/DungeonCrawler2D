// Generic boundary-line overlay: a thin flat-colored band on one side of a tile.
// Replaces the retired 0x72 wall_edge_*/wall_top_mid sprites for every "this
// surface's silhouette needs a seam here" cue (ledge tops, run ends, wall rim
// caps) — pack-agnostic, so it draws identically over any of the 7 packs.
import type Phaser from "phaser";
import { placeFractionalRect } from "./placeSprite.js";

export type EdgeSide = "north" | "south" | "east" | "west";

/** Fraction of a tile's width/height the line band covers. */
const LINE_THICKNESS_FRAC = 0.12;

/** Draws a thin `color` band along one edge of tile (wx, wy) at `alpha`, shifted
 * screen-up by `liftPx` (docs/ELEVATION-PROJECTION.md — a walkable top's outline
 * is surface content, so it rides the same cap shift as its floor). */
export function drawEdgeLine(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  wx: number,
  wy: number,
  side: EdgeSide,
  color: number,
  alpha = 1,
  liftPx = 0,
): void {
  const t = LINE_THICKNESS_FRAC;
  switch (side) {
    case "north":
      placeFractionalRect(scene, container, wx, wy, [0, 1], [0, t], color, alpha, liftPx);
      return;
    case "south":
      placeFractionalRect(scene, container, wx, wy, [0, 1], [1 - t, 1], color, alpha, liftPx);
      return;
    case "west":
      placeFractionalRect(scene, container, wx, wy, [0, t], [0, 1], color, alpha, liftPx);
      return;
    case "east":
      placeFractionalRect(scene, container, wx, wy, [1 - t, 1], [0, 1], color, alpha, liftPx);
      return;
  }
}
