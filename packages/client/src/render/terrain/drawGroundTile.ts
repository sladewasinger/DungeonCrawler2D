// Ground tile rendering: floor/void base, pit interior walls, stair treads,
// ledge-outline edges, and single-tile props — everything that isn't a raised
// face row or wall cell. Raised walkable tops keep real floor art; topEdges.ts
// outlines every side that drops. Baked tile lighting shades every layer.
import { stairVisualAt, TILE } from "@dc2d/engine";
import type Phaser from "phaser";
import { drawStairTreads } from "./drawStairTread.js";
import { drawSubtleSlope } from "./drawSubtleSlope.js";
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

const ORTHO4: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

/** True once any orthogonal neighbor is NOT chasm-depth — this cell borders the rim, not deep void. */
function isChasmRim(world: TerrainWorld, wx: number, wy: number): boolean {
  return ORTHO4.some(([dx, dy]) => !isChasmDepth(world.heightAt(wx + dx, wy + dy)));
}

const CHASM_GHOST_RIM_ALPHA = 0.2;
const CHASM_GHOST_DEEP_ALPHA = 0.14;

/**
 * A faint hint of the floor a chasm/hole tile used to be, at rim-vs-deep
 * alpha (VISUAL_DIRECTION's "holes read as HOLES," wave95 round 2) — the
 * "hole" sprite alone reads as a flat unrendered gap at a glance; this ghost
 * plus the rim/deep alpha step gives it real depth without fighting the
 * sprite's own cave-mouth shading (heightShade.ts's CHASM_FACTOR doc).
 */
function drawChasmGhost(
  scene: Phaser.Scene,
  below: Phaser.GameObjects.Container,
  world: TerrainWorld,
  wx: number,
  wy: number,
  height: number,
  lightTint: number,
): void {
  if (!isChasmDepth(height)) return;
  const alpha = isChasmRim(world, wx, wy) ? CHASM_GHOST_RIM_ALPHA : CHASM_GHOST_DEEP_ALPHA;
  const ghostTint = multiplyTint(heightTint(0), lightTint);
  placeSprite(scene, below, wx, wy, floorFrame(wx, wy, world.zoneAt(wx, wy), false), { tint: ghostTint, alpha });
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
  const tile = world.tileAt(wx, wy);

  const pit = pitFaceRowAt(world, wx, wy);
  if (pit !== null) {
    drawPitFaceCell(scene, below, world, wx, wy, pit, lightTint);
    return;
  }

  // A run's physical Stairs tiles AND its flanking RUN_PADDING Floor tiles
  // share one continuous groundAt ramp — draw both from that same continuous
  // height, or a padding tile's real slope renders as flat floor (the "I only
  // know there's a staircase because my character moves up" bug).
  const stairVisual = stairVisualAt(world, wx, wy);
  const height = stairVisual ? world.groundAt(wx + 0.5, wy + 0.5) : world.heightAt(wx, wy);
  const tint = multiplyTint(heightTint(height), lightTint);

  const isEdgeNeighbor = (dx: number, dy: number): boolean =>
    world.tileAt(wx + dx, wy + dy) === TILE.Wall || isChasmDepth(world.heightAt(wx + dx, wy + dy));
  const base = isChasmDepth(height) ? "hole" : floorFrame(wx, wy, world.zoneAt(wx, wy), isNearEdge(isEdgeNeighbor));
  placeSprite(scene, below, wx, wy, base, { tint });
  drawChasmGhost(scene, below, world, wx, wy, height, lightTint);

  drawTopEdges(scene, below, world, wx, wy, height, lightTint);

  if (tile === TILE.Stairs) {
    placeSprite(scene, below, wx, wy, "floor_stairs", { tint, angle: stairAngle(world, wx, wy) });
  }
  if (stairVisual) {
    drawStairTreads(scene, below, wx, wy, stairVisual.direction, stairVisual.t, lightTint);
  } else {
    // Sub-integer height legibility (pockets, repaired-cliff half-steps): a
    // stair run's own tread art above already covers this same visual job.
    drawSubtleSlope(scene, below, world, wx, wy);
  }

  const prop = propFrame(tile);
  if (prop) placeSprite(scene, below, wx, wy, prop.frame, prop.tint !== undefined ? { tint: prop.tint } : {});
}
