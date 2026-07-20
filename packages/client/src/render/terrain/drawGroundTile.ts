// Ground tile rendering: floor/void base, pit interior walls, stair treads,
// ledge-outline edges, and single-tile props — everything that isn't a raised
// face row or wall cell. Raised walkable tops keep real floor art; topEdges.ts
// outlines every side that drops. Baked tile lighting shades every layer. Floor
// and pit-face art come from the debug tileset + autotile.ts's bitmask solve
// (debugArt.ts); boundary lines are generic (edgeLine.ts), not baked sprites.
import { stairVisualAt, TILE } from "@dc2d/engine";
import type Phaser from "phaser";
import { pickFloorFrame, pickStairFrame, pickWallFrame, wallAutotileAt } from "./debugArt.js";
import { placeDebugTile, placeWallCornerDots } from "./debugSprite.js";
import { drawStairTreads } from "./drawStairTread.js";
import { drawSubtleSlope } from "./drawSubtleSlope.js";
import { drawEdgeLine } from "./edgeLine.js";
import { faceRowShade, heightTint, isChasmDepth, multiplyTint, topEdgeHighlightTint } from "./heightShade.js";
import { pitFaceRowAt, type PitFaceRow } from "./pitFace.js";
import { propFrame } from "./propFrame.js";
import { placeFillRect, placeSprite } from "./placeSprite.js";
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
  const { mask4, corners } = wallAutotileAt(world, wx, wy);
  placeDebugTile(scene, below, wx, wy, pickWallFrame(mask4), { tint });
  placeWallCornerDots(scene, below, wx, wy, corners);
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
 * A faint hint of the floor a chasm/hole tile used to be, at rim-vs-deep alpha
 * (VISUAL_DIRECTION's "holes read as HOLES") — a flat void alone reads as an
 * unrendered gap at a glance; this ghost plus the rim/deep alpha step gives it
 * real depth without needing a dedicated "hole" sprite from any pack.
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
  placeDebugTile(scene, below, wx, wy, pickFloorFrame(), { tint: ghostTint, alpha });
}

/**
 * The outline lines around a walkable top's dropping edges — drawn with
 * topEdgeHighlightTint (a lit-rim seam), not the tile's own flat fill tint, so
 * a raised top's silhouette pops instead of reading as a same-tone floating
 * strip (docs/ROADMAP.md's "single walls" legibility bug). Corners draw as two
 * straight lines meeting, not a dedicated mitered piece — a fair simplification
 * once the lines are generic bands instead of pack-specific corner sprites.
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
  if (edges.west) drawEdgeLine(scene, below, wx, wy, "west", tint);
  if (edges.east) drawEdgeLine(scene, below, wx, wy, "east", tint);
  if (edges.north) drawEdgeLine(scene, below, wx, wy, "north", tint);
  if (edges.southCornerLeft) {
    drawEdgeLine(scene, below, wx, wy, "south", tint);
    drawEdgeLine(scene, below, wx, wy, "west", tint);
  }
  if (edges.southCornerRight) {
    drawEdgeLine(scene, below, wx, wy, "south", tint);
    drawEdgeLine(scene, below, wx, wy, "east", tint);
  }
  if (edges.southDashEndWest || edges.southDashEndEast || edges.southDash) {
    drawEdgeLine(scene, below, wx, wy, "south", tint);
  }
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

  if (isChasmDepth(height)) {
    // No pack carries dedicated "void" art (the schema's `hazards` category is lava/spikes,
    // not a plain hole) — a solid fill in the same chasm tint reads as a dark gap; the ghost
    // below adds the "used to be floor" echo VISUAL_DIRECTION asks for.
    placeFillRect(scene, below, wx, wy, tint);
  } else {
    placeDebugTile(scene, below, wx, wy, pickFloorFrame(), { tint });
  }
  drawChasmGhost(scene, below, world, wx, wy, height, lightTint);

  drawTopEdges(scene, below, world, wx, wy, height, lightTint);

  if (tile === TILE.Stairs && stairVisual) {
    placeDebugTile(scene, below, wx, wy, pickStairFrame(stairVisual.direction), { tint });
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
