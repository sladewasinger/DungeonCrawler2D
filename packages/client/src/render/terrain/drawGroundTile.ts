// Ground tile rendering: floor/void base, pit interior walls, stair treads,
// ledge-outline edges, and single-tile props — everything that isn't a raised
// face row or wall cell. Raised walkable tops keep real floor art; cliffMask.ts
// outlines every side that drops. Baked tile lighting shades every layer. Floor
// and pit-face art come from the debug tileset + autotile.ts's bitmask solve
// (debugArt.ts); boundary lines are generic (edgeLine.ts), not baked sprites.
//
// docs/ELEVATION-PROJECTION.md section 1: walkable surface layers here draw
// shifted screen-up by `surfaceLiftPx(height)` — computed ONCE per cell and
// threaded to every placement call below. Void cells take a separate flat-black
// path and never receive a lift. A pit-interior cell ALSO still draws its
// own north-wall face BAND (drawPitFaceCell) at its raw, unshifted row — the cap
// and the band never overlap (the band is the drop rows the cap's shift vacated).
import { stairVisualAt, TILE, type TileType } from "@dc2d/engine";
import type Phaser from "phaser";
import { floorEdgeDropsAt, floorEdgeThickness } from "./cliffMask.js";
import type { CardinalEdges } from "./autotile.js";
import { placeWallEdges } from "./debugSprite.js";
import { drawContactShade } from "./drawContactShade.js";
import { drawStairBase, stairRenderState } from "./drawStairSurface.js";
import { drawWallTile, southFaceColor } from "./drawWallTile.js";
import { drawEdgeLine, type EdgeSide } from "./edgeLine.js";
import { heightTint, multiplyTint, topEdgeHighlightTint, VOID_SURFACE_COLOR } from "./heightShade.js";
import { type CapOccluderFor, surfaceContainerFor } from "./occluderBand.js";
import { pitFaceRowAt, pitStepFaceRowsAt } from "./pitFace.js";
import { propFrame } from "./propFrame.js";
import { placeFillRect, placeSprite, surfaceLiftBakePx } from "./placeSprite.js";
import {
  drawsVoidUnderlay,
  northClimbingStairCoversUnderlay,
  renderedSurfaceHeight,
} from "./stairSurface.js";
import { screenClimbDirIndex } from "./stairScreenDirection.js";
import { stacksVertically } from "./stairTread.js";
import { verticalStairProjectedRange } from "./verticalStairSurface.js";
import { hasVoidNeighborAt, isVoidCellAt } from "./faces.js";
import type { TerrainWorld } from "./terrainWorld.js";
import type { ViewTerrainWorld } from "./viewWorld.js";

/**
 * A pit cell carrying an interior north-wall row draws brick instead of its
 * floor/hole art. Unchanged by the projection: this band draws at its own RAW
 * (wx, wy) — never shifted — always into `below`, exactly as before the
 * caller stopped early-returning around it (a pit's brick rows sit below the
 * base plane, so they never compete with the dynamic entity-depth band the
 * way a raised face's rows can; see occluderBand.ts's module doc).
 */
function drawPitFaceCell(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  world: TerrainWorld,
  wx: number,
  wy: number,
  pit: NonNullable<ReturnType<typeof pitFaceRowAt>>,
  lightTint: number,
): void {
  drawWallTile(scene, world, wx, wy, container, 0, { ...pit, isStep: false }, pitFaceSideEdges(world, wx, wy, pit), southFaceColor(lightTint));
}

function samePitFace(
  world: TerrainWorld,
  wx: number,
  wy: number,
  pit: NonNullable<ReturnType<typeof pitFaceRowAt>>,
): boolean {
  const neighbor = pitFaceRowAt(world, wx, wy);
  return neighbor !== null && neighbor.rowFromTop === pit.rowFromTop && neighbor.surfaceHeight === pit.surfaceHeight;
}

function pitFaceSideEdges(
  world: TerrainWorld,
  wx: number,
  wy: number,
  pit: NonNullable<ReturnType<typeof pitFaceRowAt>>,
): Partial<CardinalEdges> {
  return {
    west: !samePitFace(world, wx - 1, wy, pit),
    east: !samePitFace(world, wx + 1, wy, pit),
  };
}

function drawPitStepFaces(
  scene: Phaser.Scene,
  world: TerrainWorld,
  wx: number,
  wy: number,
  capOccluderFor: CapOccluderFor,
  lightTint: number,
): void {
  for (const face of pitStepFaceRowsAt(world, wx, wy)) {
    const liftPx = surfaceLiftBakePx(face.surfaceHeight - face.rowFromTop);
    const container = capOccluderFor(face.screenY);
    drawWallTile(
      scene,
      world,
      wx,
      wy,
      container,
      liftPx,
      face,
      {},
      southFaceColor(lightTint),
    );
    if (face.rowFromTop === 1) {
      drawEdgeLine(scene, container, wx, wy, "north", multiplyTint(topEdgeHighlightTint(face.surfaceHeight), lightTint), 1, liftPx);
    }
  }
}

function groundSurfaceContainer(
  world: ViewTerrainWorld,
  wx: number,
  wy: number,
  height: number,
  physicalHeight: number,
  stairDirection: number | null,
  below: Phaser.GameObjects.Container,
  capOccluderFor: CapOccluderFor,
): Phaser.GameObjects.Container {
  if (stairDirection === null || !stacksVertically(stairDirection)) {
    return surfaceContainerFor(world, wx, wy, height, below, capOccluderFor);
  }

  const [top, bottom] = verticalStairProjectedRange(physicalHeight);
  return capOccluderFor(
    wy,
    Math.max(0, Math.ceil(-top)),
    Math.max(0, Math.ceil(bottom - 1)),
  );
}

/**
 * The white perimeter outline around a walkable cap's dropping edges — RAISED
 * WALKABLE FLOOR surfaces ONLY (docs/ROADMAP.md "OUTLINE SCOPE CORRECTION",
 * user ruling 2026-07-20: wall bodies NEVER carry white side edges; their
 * language stays the black autotile border — the scope guard is structural,
 * since drawTile.ts routes every Wall cell away from this module). Every
 * exposed side outlines, south included: under the own-tile face model the rim
 * cell is itself walkable, draws its own shifted cap, and owns its south edge —
 * the line lands exactly on the cap/face-band seam via the shared `liftPx`, so
 * the pre-projection "dash above the face run" neighbor bookkeeping is gone.
 * Drawn with topEdgeHighlightTint (a lit-rim seam), not the tile's own flat
 * fill tint, so a raised top's silhouette pops instead of reading as a
 * same-tone floating strip (docs/ROADMAP.md's "single walls" legibility bug).
 * Corners draw as two straight bands meeting, not a mitered piece — fair once
 * the lines are generic bands instead of pack-specific corner sprites.
 */
function drawTopEdges(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  world: TerrainWorld,
  wx: number,
  wy: number,
  height: number,
  lightTint: number,
  liftPx: number,
): void {
  const drops = floorEdgeDropsAt(world, wx, wy);
  const tint = multiplyTint(topEdgeHighlightTint(height), lightTint);
  const edges: ReadonlyArray<readonly [EdgeSide, number]> = Object.entries(drops) as Array<[EdgeSide, number]>;
  for (const [side, drop] of edges) {
    if (drop > 0) drawEdgeLine(scene, container, wx, wy, side, tint, 1, liftPx, floorEdgeThickness(drop));
  }
}

/**
 * Every SURFACE layer this cell owns, drawn into `container` shifted screen-up
 * by `liftPx` (docs/ELEVATION-PROJECTION.md section 1) — walkable floor,
 * subtle-slope, stair tread + frame, top-edge outlines, and props. Void cells
 * bypass this surface path and draw a flat black square at their raw row.
 * `height`/`liftPx`/`tint` are already resolved by the caller (the ramp-center
 * height for a stair tile, or plain `heightAt` otherwise) so this never
 * re-derives them.
 */
function drawSurface(
  scene: Phaser.Scene,
  world: ViewTerrainWorld,
  wx: number,
  wy: number,
  container: Phaser.GameObjects.Container,
  tile: TileType,
  height: number,
  stairVisual: ReturnType<typeof stairVisualAt>,
  tint: number,
  lightTint: number,
  liftPx: number,
): void {
  const stairState = stairRenderState(stairVisual, world);
  drawStairBase(scene, container, world, wx, wy, stairState, tint, lightTint, liftPx);
  // Stairs draw their own projected tread/riser AO. Tile AO would see the
  // adjacent half of a scaled run as a higher floor and shade its inner seam.
  if (stairState.surface !== "stepped") {
    drawContactShade(scene, container, world, wx, wy, height, liftPx);
  }

  if (tile !== TILE.Stairs) {
    drawTopEdges(scene, container, world, wx, wy, height, lightTint, liftPx);
  }
  const prop = propFrame(tile);
  if (prop) {
    placeSprite(scene, container, wx, wy, prop.frame, {
      ...(prop.tint !== undefined ? { tint: prop.tint } : {}),
      liftBakePx: liftPx,
    });
  }
}

const VOID_EDGES: CardinalEdges = { north: true, east: true, south: true, west: true };

export function drawVoidTile(
  scene: Phaser.Scene,
  _world: ViewTerrainWorld,
  wx: number,
  wy: number,
  below: Phaser.GameObjects.Container,
): void {
  placeFillRect(scene, below, wx, wy, VOID_SURFACE_COLOR);
  placeWallEdges(scene, below, wx, wy, VOID_EDGES);
}

export function drawGroundTile(
  scene: Phaser.Scene,
  world: ViewTerrainWorld,
  wx: number,
  wy: number,
  below: Phaser.GameObjects.Container,
  capOccluderFor: CapOccluderFor,
  lightTint: number,
): void {
  const tile = world.tileAt(wx, wy);

  if (isVoidCellAt(world, wx, wy)) return drawVoidTile(scene, world, wx, wy, below);

  // A run's physical Stairs tiles AND its flanking RUN_PADDING Floor tiles
  // share one continuous groundAt ramp — draw both from that same continuous
  // height, or a padding tile's real slope renders as flat floor (the "I only
  // know there's a staircase because my character moves up" bug).
  // stairVisualAt is a real height-gradient fact (climb direction is which
  // neighbor is physically higher), so unlike everything else in this
  // function it must query the REAL world at the REAL coordinates, not the
  // view-space proxy — see viewWorld.ts's module doc.
  const real = world.toReal(wx, wy);
  const stairVisual = stairVisualAt(world.real, real.x, real.y);
  const physicalHeight = stairVisual ? world.groundAt(wx + 0.5, wy + 0.5) : world.heightAt(wx, wy);
  const height = renderedSurfaceHeight(tile, physicalHeight);
  const tint = multiplyTint(heightTint(height), lightTint); const liftPx = surfaceLiftBakePx(height);
  // A below-zero cap shifts down into later rows, leaving its raw row behind.
  // That space is vertical void/wall volume, not a second floor: keep it black
  // so the sole gray walkable surface remains the shifted cap below.
  if (
    drawsVoidUnderlay(tile, height) &&
    !northClimbingStairCoversUnderlay(world, wx, wy, height)
  ) {
    placeFillRect(scene, below, wx, wy, VOID_SURFACE_COLOR);
  }
  const screenStairDirection = stairVisual
    ? screenClimbDirIndex(stairVisual.direction, world.orientation)
    : null;
  const container = groundSurfaceContainer(
    world,
    wx,
    wy,
    height,
    physicalHeight,
    screenStairDirection,
    below,
    capOccluderFor,
  );

  drawSurface(scene, world, wx, wy, container, tile, height, stairVisual, tint, lightTint, liftPx);

  // The cap above always draws first; a cell that ALSO owns a pit-interior
  // north-wall row (drop below the base plane) overlays that face BAND on top,
  // at its own raw row, unshifted — the rows the cap's downward shift vacated
  // (docs/ELEVATION-PROJECTION.md section 1's face rule). `below` here, not
  // `container`: the band never moves, so it always fits the flat base sheet
  // exactly like today, regardless of which container the shifted cap used.
  const pit = hasVoidNeighborAt(world, wx, wy) ? null : pitFaceRowAt(world, wx, wy);
  if (pit !== null) drawPitFaceCell(scene, container, world, wx, wy, pit, lightTint);
  if (!hasVoidNeighborAt(world, wx, wy)) drawPitStepFaces(scene, world, wx, wy, capOccluderFor, lightTint);
}
