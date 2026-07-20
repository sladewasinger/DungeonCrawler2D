// Ground tile rendering: floor/void base, pit interior walls, stair treads,
// ledge-outline edges, and single-tile props — everything that isn't a raised
// face row or wall cell. Raised walkable tops keep real floor art; topEdges.ts
// outlines every side that drops. Baked tile lighting shades every layer.
import { TILE } from "@dc2d/engine";
import type Phaser from "phaser";
import { floorFrame, isNearEdge } from "./floorFrame.js";
import { faceRowShade, heightTint, isChasmDepth, multiplyTint, topEdgeHighlightTint } from "./heightShade.js";
import { pitFaceRowAt, pitRunPieceAt, type PitFaceRow } from "./pitFace.js";
import { placeSprite } from "./placeSprite.js";
import { propFrame } from "./propFrame.js";
import { stairAngle } from "./stairFrame.js";
import type { TerrainWorld } from "./terrainWorld.js";
import { topEdgesAt } from "./topEdges.js";

/** A pit cell carrying an interior north-wall row draws brick instead of its floor/hole art. */
function drawPitFaceCell(
  scene: Phaser.Scene,
  below: Phaser.GameObjects.Container,
  world: TerrainWorld,
  wx: number,
  wy: number,
  pit: PitFaceRow,
  lightTint: number,
): void {
  const shade = faceRowShade(pit.rowFromTop, pit.truncated);
  const tint = multiplyTint(multiplyTint(heightTint(pit.surfaceHeight), shade), lightTint);
  const piece = pitRunPieceAt(world, wx, wy);
  placeSprite(scene, below, wx, wy, piece.frame, { tint });
  if (piece.closeWest) placeSprite(scene, below, wx, wy, "wall_edge_mid_left", { tint });
  if (piece.closeEast) placeSprite(scene, below, wx, wy, "wall_edge_mid_right", { tint });
}

/**
 * The outline pieces around a walkable top's dropping edges — drawn with
 * topEdgeHighlightTint (a lit-rim seam), not the tile's own flat fill tint,
 * so a raised top's silhouette pops instead of reading as a same-tone
 * floating strip (docs/ROADMAP.md's "single walls" legibility bug).
 */
function drawTopEdges(
  scene: Phaser.Scene,
  below: Phaser.GameObjects.Container,
  world: TerrainWorld,
  wx: number,
  wy: number,
  height: number,
  lightTint: number,
): void {
  const edges = topEdgesAt(world, wx, wy);
  const tint = multiplyTint(topEdgeHighlightTint(height), lightTint);
  if (edges.southCornerLeft) placeSprite(scene, below, wx, wy, "wall_edge_bottom_left", { tint });
  if (edges.southCornerRight) placeSprite(scene, below, wx, wy, "wall_edge_bottom_right", { tint });
  if (edges.southDashEndWest) placeSprite(scene, below, wx, wy, "wall_edge_top_left", { tint });
  if (edges.southDashEndEast) placeSprite(scene, below, wx, wy, "wall_edge_top_right", { tint });
  if (edges.southDash) placeSprite(scene, below, wx, wy, "wall_top_mid", { tint });
  if (edges.west) placeSprite(scene, below, wx, wy, "wall_edge_mid_left", { tint });
  if (edges.east) placeSprite(scene, below, wx, wy, "wall_edge_mid_right", { tint });
  if (edges.north) placeSprite(scene, below, wx, wy, "wall_top_mid", { tint, flipY: true });
}

export function drawGroundTile(
  scene: Phaser.Scene,
  world: TerrainWorld,
  wx: number,
  wy: number,
  below: Phaser.GameObjects.Container,
  lightTint: number,
): void {
  const height = world.heightAt(wx, wy);
  const tile = world.tileAt(wx, wy);
  const tint = multiplyTint(heightTint(height), lightTint);

  const pit = pitFaceRowAt(world, wx, wy);
  if (pit !== null) {
    drawPitFaceCell(scene, below, world, wx, wy, pit, lightTint);
    return;
  }

  const isEdgeNeighbor = (dx: number, dy: number): boolean =>
    world.tileAt(wx + dx, wy + dy) === TILE.Wall || isChasmDepth(world.heightAt(wx + dx, wy + dy));
  const base = isChasmDepth(height) ? "hole" : floorFrame(wx, wy, world.zoneAt(wx, wy), isNearEdge(isEdgeNeighbor));
  placeSprite(scene, below, wx, wy, base, { tint });

  drawTopEdges(scene, below, world, wx, wy, height, lightTint);

  if (tile === TILE.Stairs) {
    placeSprite(scene, below, wx, wy, "floor_stairs", { tint, angle: stairAngle(world, wx, wy) });
  }

  const prop = propFrame(tile);
  if (prop) placeSprite(scene, below, wx, wy, prop.frame, prop.tint !== undefined ? { tint: prop.tint } : {});
}
