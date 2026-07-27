// One-tile dispatch under the own-tile face model: face rows draw on the raised
// cells themselves (into the occluder row of their face's BOTTOM, so the whole
// face shares one depth); walls that aren't face are plain autotiled wall cells;
// everything else is ground. Baked tile lighting multiplies into every layer here.
// Art comes from the debug tileset + autotile.ts's bitmask solve (debugArt.ts) —
// borders draw from 2D map-space material adjacency, never per-row, so a face row
// and a plain wall cell at the same (x, y) always agree on where the border is.
//
// docs/ELEVATION-PROJECTION.md's whole-scene shift (section 1): a face row no
// longer REPLACES its cell's rendering — a WALKABLE (non-Wall) face cell always
// ALSO draws its normal shifted ground/cap (drawGroundTile), then this module
// overlays the raw, unshifted brick BAND on top, filling the rows the cap's
// shift vacated. A face cell that IS solid Wall terrain keeps exactly today's
// behavior (raw band only, no separate cap) — it's never walkable, so there is
// no "surface an entity stands on" to shift; see docs/ASSUMPTIONS.md row 305.
import { stairVisualAt, TILE } from "@dc2d/engine";
import type Phaser from "phaser";
import { pickFloorFrame } from "./debugArt.js";
import { placeDebugTile, placeWallEdges } from "./debugSprite.js";
import { drawGroundTile } from "./drawGroundTile.js";
import { drawVerticalStairSideOutlines } from "./steppedStairSurface.js";
import { drawWallTile, southFaceColor } from "./drawWallTile.js";
import { heightTint, multiplyTint, VOID_SURFACE_COLOR } from "./heightShade.js";
import { bakesIntoStaticBase, stripOverhangTiles, surfaceContainerFor, type CapOccluderFor } from "./occluderBand.js";
import { type OwnFaceRow } from "./ownFace.js";
import { visibleTerrainFaceAt } from "./stairFace.js";
import { placeFillRect, surfaceLiftBakePx } from "./placeSprite.js";
import { tileKey, type StructureMap } from "./structures.js";
import type { LightField } from "./tileLight.js";
import type { ViewTerrainWorld } from "./viewWorld.js";
import { freestandingHeightBodyRows } from "./heightColumn.js";
import { screenClimbDirIndex } from "./stairScreenDirection.js";
import { stacksVertically } from "./stairTread.js";
import { verticalStairProjectedRange } from "./verticalStairSurface.js";
import { drawPartialHeightFace, drawWallVolume, wallBehindHorizontalStair } from "./wallProjection.js";

/** `overhangTiles` tells the strip how far above its base row this content sits, so it bakes just tall enough. */
export type OccluderFor = (wy: number, overhangTiles?: number) => Phaser.GameObjects.Container;

function drawFaceCell(
  scene: Phaser.Scene,
  world: ViewTerrainWorld,
  wx: number,
  wy: number,
  face: OwnFaceRow,
  below: Phaser.GameObjects.Container,
  occluderFor: OccluderFor,
  light: LightField,
  behindHorizontalStair: boolean,
): void {
  const groundY = wy + face.distanceToGround;
  const lowerHeight = world.heightAt(wx, groundY);
  const liftPx = surfaceLiftBakePx(lowerHeight);
  // Rows high above open ground can never interleave with an entity's depth
  // (occluderBand.ts's proof), so they bake as static backdrop — identical
  // pixels, zero per-frame strip cost. Only the band near the foot stays dynamic.
  const container = behindHorizontalStair || (bakesIntoStaticBase(face.distanceToGround) && Math.abs(lowerHeight) < 0.01)
    ? below
    : occluderFor(
        wy + face.distanceToGround - 1,
        stripOverhangTiles(face.distanceToGround) + Math.max(0, Math.ceil(lowerHeight)),
      );
  const foot = world.toReal(wx, groundY);
  drawWallTile(
    scene,
    world,
    wx,
    wy,
    container,
    liftPx,
    undefined,
    behindHorizontalStair
      ? { north: false, east: false, south: false, west: false }
      : faceSideEdges(world, wx, wy, face, lowerHeight),
    southFaceColor(light.tintAt(foot.x, foot.y)),
  );
  // No white cliff edges here (docs/ROADMAP.md "OUTLINE SCOPE CORRECTION", user
  // ruling 2026-07-20): a face band is wall-material body, and wall bodies keep
  // the black autotile border only. A WALKABLE face cell's white perimeter rides
  // its SHIFTED cap instead — drawGroundTile's drawTopEdges, which the dispatch
  // below always runs for non-Wall cells before overlaying this band.
}

/**
 * Face bands are screen-relative: in the rotated view, neighboring face cells
 * that land on the same projected row are one continuous camera-facing wall.
 * Suppress their shared vertical border explicitly instead of leaving the
 * generic wall-volume probe to infer it from source-space height columns.
 */
function faceSideEdges(
  world: ViewTerrainWorld,
  wx: number,
  wy: number,
  face: OwnFaceRow,
  lowerHeight: number,
): Pick<CardinalEdges, "east" | "west"> {
  const connected = (dx: -1 | 1): boolean => {
    const neighbor = visibleTerrainFaceAt(world, wx + dx, wy);
    if (neighbor === null) return false;
    const neighborLowerHeight = world.heightAt(wx + dx, wy + neighbor.distanceToGround);
    return Math.abs(neighborLowerHeight - lowerHeight) < 0.01;
  };
  return { east: !connected(1), west: !connected(-1) };
}

function drawSuppressedTile(
  scene: Phaser.Scene,
  world: ViewTerrainWorld,
  wx: number,
  wy: number,
  below: Phaser.GameObjects.Container,
  capOccluderFor: CapOccluderFor,
  lightTint: number,
): void {
  // The portal cell keeps floor under transparent door pixels; suppressed wall
  // cells above keep only quiet mass fill — the assembly draws over both. Both
  // still shift with their own height, same as any other cap (a door can sit on
  // a raised terrace — structures.ts's own module doc).
  const height = world.heightAt(wx, wy);
  const liftPx = surfaceLiftBakePx(height);
  const container = surfaceContainerFor(world, wx, wy, height, below, capOccluderFor);
  if (world.tileAt(wx, wy) === TILE.Wall) {
    placeFillRect(scene, container, wx, wy, VOID_SURFACE_COLOR, liftPx);
  } else {
    placeDebugTile(scene, container, wx, wy, pickFloorFrame(), {
      tint: multiplyTint(heightTint(height), lightTint),
      liftBakePx: liftPx,
    });
  }
}

function drawWall(
  scene: Phaser.Scene,
  world: ViewTerrainWorld,
  wx: number,
  wy: number,
  below: Phaser.GameObjects.Container,
  occluderFor: OccluderFor,
  capOccluderFor: CapOccluderFor,
  face: OwnFaceRow | null,
  light: LightField,
  lightTint: number,
): void {
  const height = world.heightAt(wx, wy);
  drawWallVolume(scene, below, wx, wy, height);
  const behindHorizontalStair = wallBehindHorizontalStair(world, wx, wy, face);
  const container = behindHorizontalStair
    ? below
    : surfaceContainerFor(world, wx, wy, height, below, capOccluderFor);
  drawWallTile(
    scene,
    world,
    wx,
    wy,
    container,
    surfaceLiftBakePx(height),
    undefined,
    behindHorizontalStair
      ? { north: false, east: false, south: false, west: false }
      : {},
  );
  drawFreestandingHeightBody(scene, world, wx, wy, occluderFor, lightTint);
  if (face !== null) drawFaceCell(scene, world, wx, wy, face, below, occluderFor, light, behindHorizontalStair);
}

export function drawTile(
  scene: Phaser.Scene,
  world: ViewTerrainWorld,
  wx: number,
  wy: number,
  below: Phaser.GameObjects.Container,
  occluderFor: OccluderFor,
  capOccluderFor: CapOccluderFor,
  structures: StructureMap,
  light: LightField,
): void {
  const real = world.toReal(wx, wy);
  const lightTint = light.tintAt(real.x, real.y);
  if (structures.suppressed.has(tileKey(wx, wy))) {
    drawSuppressedTile(scene, world, wx, wy, below, capOccluderFor, lightTint);
    return;
  }
  const face = visibleTerrainFaceAt(world, wx, wy);
  drawPartialHeightFace(scene, below, world, wx, wy, lightTint);
  if (world.tileAt(wx, wy) === TILE.Wall) {
    drawWall(scene, world, wx, wy, below, occluderFor, capOccluderFor, face, light, lightTint);
    return;
  }
  // Walkable ground ALWAYS draws its shifted cap; a raised platform whose south
  // edge also drops (face !== null) additionally overlays the raw band on top —
  // the rows the cap's shift vacated (module doc above).
  drawGroundTile(scene, world, wx, wy, below, capOccluderFor, lightTint);
  drawFreestandingHeightBody(scene, world, wx, wy, occluderFor, lightTint);
  if (face !== null) drawFaceCell(scene, world, wx, wy, face, below, occluderFor, light, false);
  drawForegroundVerticalStairOutlines(scene, world, wx, wy, occluderFor, lightTint);
}

function drawFreestandingHeightBody(
  scene: Phaser.Scene,
  world: ViewTerrainWorld,
  wx: number,
  wy: number,
  occluderFor: OccluderFor,
  lightTint: number,
): void {
  const bodyRows = freestandingHeightBodyRows(world, wx, wy);
  if (bodyRows.length === 0) return;
  const container = occluderFor(wy, bodyRows.length);
  for (const bodyRow of bodyRows) {
    placeFillRect(scene, container, wx, wy, southFaceColor(lightTint), surfaceLiftBakePx(bodyRow));
    placeWallEdges(scene, container, wx, wy, {
      north: false,
      south: false,
      west: world.heightAt(wx - 1, wy) < bodyRow,
      east: world.heightAt(wx + 1, wy) < bodyRow,
    }, surfaceLiftBakePx(bodyRow));
  }
}

function drawForegroundVerticalStairOutlines(
  scene: Phaser.Scene,
  world: ViewTerrainWorld,
  wx: number,
  wy: number,
  occluderFor: OccluderFor,
  lightTint: number,
): void {
  const real = world.toReal(wx, wy);
  const stair = stairVisualAt(world.real, real.x, real.y);
  if (!stair) return;
  const screenDirection = screenClimbDirIndex(stair.direction, world.orientation);
  if (!stacksVertically(screenDirection)) return;
  const [top, bottom] = verticalStairProjectedRange(world.groundAt(wx + 0.5, wy + 0.5));
  const below = Math.max(0, Math.ceil(bottom - 1));
  const above = below + Math.max(0, Math.ceil(-top));
  drawVerticalStairSideOutlines(
    scene,
    occluderFor(wy + below, above),
    world,
    wx,
    wy,
    screenDirection,
    lightTint,
  );
}
