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
import { pickFloorFrame, pickWallFrame, wallAutotileAt } from "./debugArt.js";
import { placeDebugTile, placeWallCornerDots } from "./debugSprite.js";
import { drawGroundTile } from "./drawGroundTile.js";
import { drawWallTile } from "./drawWallTile.js";
import { faceRowShade, heightTint, multiplyTint, WALL_FILL_COLOR } from "./heightShade.js";
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
  // Rows high above open ground can never interleave with an entity's depth
  // (occluderBand.ts's proof), so they bake as static backdrop — identical
  // pixels, zero per-frame strip cost. Only the band near the foot stays dynamic.
  const container = bakesIntoStaticBase(face.distanceToGround)
    ? below
    : occluderFor(wy + face.distanceToGround - 1, stripOverhangTiles(face.distanceToGround));
  const shade = faceRowShade(face.rowFromTop, face.truncated);
  // The face is lit by the open ground at its FOOT: the light flood never
  // enters wall cells, so sampling the face's own cell would leave every brick
  // band ambient-dark even directly beside a torch. Baked lighting is genuinely
  // world-space data (tileLight.ts's BFS flows through real walls), so this is
  // the one lookup here that must go through the real world's coordinates, not
  // the view-space (wx, wy) everything else in this function reads.
  const groundReal = world.toReal(wx, wy + face.distanceToGround);
  const lightTint = light.tintAt(groundReal.x, groundReal.y);
  const tint = multiplyTint(multiplyTint(heightTint(face.surfaceHeight), shade), lightTint);
  // wallAutotileAt reads `world` (the view-space proxy) deliberately: probing its
  // cardinal neighbors in view-space yields the bit-remapped mask for whatever
  // material now sits at each SCREEN-adjacent cell — the same true world-adjacency
  // facts as ever, just visited in screen reading order, so the border still sits
  // between the same two world tiles (see viewWorld.ts's module doc).
  const { mask4, corners } = wallAutotileAt(world, wx, wy);
  placeDebugTile(scene, container, wx, wy, pickWallFrame(mask4), { tint });
  placeWallCornerDots(scene, container, wx, wy, corners);
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
    placeFillRect(scene, container, wx, wy, WALL_FILL_COLOR, liftPx);
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
    if (face !== null) {
      drawFaceCell(scene, world, wx, wy, face, below, occluderFor, light);
    } else {
      const height = world.heightAt(wx, wy);
      const container = surfaceContainerFor(world, wx, wy, height, below, capOccluderFor);
      drawWallTile(scene, world, wx, wy, container, lightTint, surfaceLiftPx(height));
    }
    return;
  }
  // Walkable ground ALWAYS draws its shifted cap; a raised platform whose south
  // edge also drops (face !== null) additionally overlays the raw band on top —
  // the rows the cap's shift vacated (module doc above).
  drawGroundTile(scene, world, wx, wy, below, capOccluderFor, lightTint);
  if (face !== null) drawFaceCell(scene, world, wx, wy, face, below, occluderFor, light);
}
