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
import { TILE } from "@dc2d/engine";
import type Phaser from "phaser";
import { pickFloorFrame } from "./debugArt.js";
import { placeDebugTile, placeWallEdges } from "./debugSprite.js";
import { drawGroundTile } from "./drawGroundTile.js";
import { drawWallTile, southFaceColor } from "./drawWallTile.js";
import { heightTint, multiplyTint, VOID_SURFACE_COLOR } from "./heightShade.js";
import {
  bakesIntoStaticBase,
  stripOverhangTiles,
  surfaceContainerFor,
  type CapOccluderFor,
} from "./occluderBand.js";
import { ownFaceRowAt, type OwnFaceRow } from "./ownFace.js";
import { placeFillRect, surfaceLiftPx } from "./placeSprite.js";
import { tileKey, type StructureMap } from "./structures.js";
import type { LightField } from "./tileLight.js";
import type { ViewTerrainWorld } from "./viewWorld.js";
import { freestandingHeightBodyRows } from "./heightColumn.js";

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
): void {
  const groundY = wy + face.distanceToGround;
  const lowerHeight = world.heightAt(wx, groundY);
  const liftPx = surfaceLiftPx(lowerHeight);
  // Rows high above open ground can never interleave with an entity's depth
  // (occluderBand.ts's proof), so they bake as static backdrop — identical
  // pixels, zero per-frame strip cost. Only the band near the foot stays dynamic.
  const container = bakesIntoStaticBase(face.distanceToGround) && Math.abs(lowerHeight) < 0.01
    ? below
    : occluderFor(
        wy + face.distanceToGround - 1,
        stripOverhangTiles(face.distanceToGround) + Math.max(0, Math.ceil(lowerHeight)),
      );
  const foot = world.toReal(wx, groundY);
  drawWallTile(scene, world, wx, wy, container, liftPx, undefined, {}, southFaceColor(light.tintAt(foot.x, foot.y)));
  // No white cliff edges here (docs/ROADMAP.md "OUTLINE SCOPE CORRECTION", user
  // ruling 2026-07-20): a face band is wall-material body, and wall bodies keep
  // the black autotile border only. A WALKABLE face cell's white perimeter rides
  // its SHIFTED cap instead — drawGroundTile's drawTopEdges, which the dispatch
  // below always runs for non-Wall cells before overlaying this band.
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
  const liftPx = surfaceLiftPx(height);
  const container = surfaceContainerFor(world, wx, wy, height, below, capOccluderFor);
  if (world.tileAt(wx, wy) === TILE.Wall) {
    placeFillRect(scene, container, wx, wy, VOID_SURFACE_COLOR, liftPx);
  } else {
    placeDebugTile(scene, container, wx, wy, pickFloorFrame(), {
      tint: multiplyTint(heightTint(height), lightTint),
      liftPx,
    });
  }
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
  const face = ownFaceRowAt(world, wx, wy);
  if (world.tileAt(wx, wy) === TILE.Wall) {
    // EVERY wall cell draws its shifted cap — face owners included (spec section 1:
    // "always draw the shifted cap THEN overlay the band"). Skipping the cap on
    // face-owning cells left every raw row that DEPENDED on one of those caps for
    // coverage (the row h screen-north, vacated by its own cap's shift) rendering
    // nothing — the scattered black squares of the 2026-07-21 production playtest.
    const height = world.heightAt(wx, wy);
    // A displaced cap leaves its source row exposed. This is wall volume, not
    // void: it must use the south-wall material and live in a depth-sorted band
    // so terrain behind it cannot leak through after the camera rotates.
    if (height !== 0 && face === null) {
      drawWallTile(scene, world, wx, wy, occluderFor(wy), 0, undefined, {}, southFaceColor(lightTint));
    }
    const container = surfaceContainerFor(world, wx, wy, height, below, capOccluderFor);
    drawWallTile(scene, world, wx, wy, container, surfaceLiftPx(height));
    // A one-cell-deep W3 has no equally high cells north/south to own its two
    // intermediate face rows. Fill those rows from the authored wall itself so
    // height runs such as W1..W5 are continuous rather than floating caps.
    drawFreestandingHeightBody(scene, world, wx, wy, occluderFor, lightTint);
    if (face !== null) drawFaceCell(scene, world, wx, wy, face, below, occluderFor, light);
    return;
  }
  // Walkable ground ALWAYS draws its shifted cap; a raised platform whose south
  // edge also drops (face !== null) additionally overlays the raw band on top —
  // the rows the cap's shift vacated (module doc above).
  drawGroundTile(scene, world, wx, wy, below, capOccluderFor, lightTint);
  drawFreestandingHeightBody(scene, world, wx, wy, occluderFor, lightTint);
  if (face !== null) drawFaceCell(scene, world, wx, wy, face, below, occluderFor, light);
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
  // A tower body is screen-south of every cap behind it. It therefore belongs
  // in the face occluder strip, not the static base sheet: a shifted cap from a
  // lower northern block would otherwise paint over this column during baking.
  const container = occluderFor(wy, bodyRows.length);
  for (const bodyRow of bodyRows) {
    placeFillRect(scene, container, wx, wy, southFaceColor(lightTint), surfaceLiftPx(bodyRow));
    placeWallEdges(scene, container, wx, wy, {
      north: false,
      south: false,
      west: world.heightAt(wx - 1, wy) < bodyRow,
      east: world.heightAt(wx + 1, wy) < bodyRow,
    }, surfaceLiftPx(bodyRow));
  }
}
