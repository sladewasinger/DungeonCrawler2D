// One-tile dispatch under the own-tile face model: face rows draw on the raised
// cells themselves (into the occluder row of their face's BOTTOM, so the whole
// face shares one depth); walls that aren't face are plain autotiled wall cells;
// everything else is ground. Baked tile lighting multiplies into every layer here.
// Art comes from the debug tileset + autotile.ts's bitmask solve (debugArt.ts) —
// borders draw from 2D map-space material adjacency, never per-row, so a face row
// and a plain wall cell at the same (x, y) always agree on where the border is.
import { TILE } from "@dc2d/engine";
import type Phaser from "phaser";
import { pickFloorFrame, pickWallFrame, wallAutotileAt } from "./debugArt.js";
import { placeDebugTile, placeWallCornerDots } from "./debugSprite.js";
import { drawGroundTile } from "./drawGroundTile.js";
import { drawWallTile } from "./drawWallTile.js";
import { faceRowShade, heightTint, multiplyTint, WALL_FILL_COLOR } from "./heightShade.js";
import { bakesIntoStaticBase, stripOverhangTiles } from "./occluderBand.js";
import { ownFaceRowAt, type OwnFaceRow } from "./ownFace.js";
import { placeFillRect } from "./placeSprite.js";
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
}

export function drawTile(
  scene: Phaser.Scene,
  world: ViewTerrainWorld,
  wx: number,
  wy: number,
  below: Phaser.GameObjects.Container,
  occluderFor: OccluderFor,
  structures: StructureMap,
  light: LightField,
): void {
  const real = world.toReal(wx, wy);
  const lightTint = light.tintAt(real.x, real.y);
  if (structures.suppressed.has(tileKey(wx, wy))) {
    // The portal cell keeps floor under transparent door pixels; suppressed wall
    // cells above keep only quiet mass fill — the assembly draws over both.
    if (world.tileAt(wx, wy) === TILE.Wall) {
      placeFillRect(scene, occluderFor(wy), wx, wy, WALL_FILL_COLOR);
    } else {
      placeDebugTile(scene, below, wx, wy, pickFloorFrame(), {
        tint: multiplyTint(heightTint(world.heightAt(wx, wy)), lightTint),
      });
    }
    return;
  }
  const face = ownFaceRowAt(world, wx, wy);
  if (face !== null) {
    drawFaceCell(scene, world, wx, wy, face, below, occluderFor, light);
    return;
  }
  if (world.tileAt(wx, wy) === TILE.Wall) {
    drawWallTile(scene, world, wx, wy, occluderFor(wy), lightTint);
    return;
  }
  drawGroundTile(scene, world, wx, wy, below, lightTint);
}
