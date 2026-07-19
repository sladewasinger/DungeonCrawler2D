// One-tile dispatch under the own-tile face model: face rows draw on the raised
// cells themselves (into the occluder row of their face's BOTTOM, so the whole
// face shares one depth); walls that aren't face are rim/pillar/fill; everything
// else is ground. Baked tile lighting multiplies into every layer here.
import { TILE } from "@dc2d/engine";
import type Phaser from "phaser";
import { drawGroundTile } from "./drawGroundTile.js";
import { drawWallTile } from "./drawWallTile.js";
import { floorFrame } from "./floorFrame.js";
import { faceRowShade, heightTint, multiplyTint, WALL_FILL_COLOR } from "./heightShade.js";
import { faceRunPieceAt, ownFaceRowAt, type OwnFaceRow } from "./ownFace.js";
import { placeFillRect, placeSprite } from "./placeSprite.js";
import { tileKey, type StructureMap } from "./structures.js";
import type { TerrainWorld } from "./terrainWorld.js";
import type { LightField } from "./tileLight.js";

export type OccluderFor = (wy: number) => Phaser.GameObjects.Container;

function drawFaceCell(
  scene: Phaser.Scene,
  world: TerrainWorld,
  wx: number,
  wy: number,
  face: OwnFaceRow,
  occluderFor: OccluderFor,
  light: LightField,
): void {
  const container = occluderFor(wy + face.distanceToGround - 1);
  const shade = faceRowShade(face.rowFromTop, face.truncated);
  // The face is lit by the open ground at its FOOT: the light flood never
  // enters wall cells, so sampling the face's own cell would leave every brick
  // band ambient-dark even directly beside a torch.
  const lightTint = light.tintAt(wx, wy + face.distanceToGround);
  const tint = multiplyTint(multiplyTint(heightTint(face.surfaceHeight), shade), lightTint);
  const piece = faceRunPieceAt(world, wx, wy);
  placeSprite(scene, container, wx, wy, piece.frame, { tint });
  // A run end's built-in mortar border is subtle; layer the explicit thin line
  // on every side that doesn't connect so the brick column never bleeds into
  // whatever non-brick art (open ground, wall interior, void) sits beside it.
  // NO horizontal cap here: wall_top_mid's dash pixels sit at the BOTTOM of its
  // frame, so a cap on this cell would land at the face's foot (or mid-face) —
  // the boundary dash belongs to the walkable top above, via topEdges.ts.
  if (piece.closeWest) placeSprite(scene, container, wx, wy, "wall_edge_mid_left", { tint });
  if (piece.closeEast) placeSprite(scene, container, wx, wy, "wall_edge_mid_right", { tint });
}

export function drawTile(
  scene: Phaser.Scene,
  world: TerrainWorld,
  wx: number,
  wy: number,
  below: Phaser.GameObjects.Container,
  occluderFor: OccluderFor,
  structures: StructureMap,
  light: LightField,
): void {
  const lightTint = light.tintAt(wx, wy);
  if (structures.suppressed.has(tileKey(wx, wy))) {
    // The portal cell keeps floor under transparent door pixels; suppressed wall
    // cells above keep only quiet mass fill — the assembly draws over both.
    if (world.tileAt(wx, wy) === TILE.Wall) {
      placeFillRect(scene, occluderFor(wy), wx, wy, WALL_FILL_COLOR);
    } else {
      placeSprite(scene, below, wx, wy, floorFrame(wx, wy, world.zoneAt(wx, wy), false), {
        tint: multiplyTint(heightTint(world.heightAt(wx, wy)), lightTint),
      });
    }
    return;
  }
  const face = ownFaceRowAt(world, wx, wy);
  if (face !== null) {
    drawFaceCell(scene, world, wx, wy, face, occluderFor, light);
    return;
  }
  if (world.tileAt(wx, wy) === TILE.Wall) {
    drawWallTile(scene, world, wx, wy, occluderFor(wy), lightTint);
    return;
  }
  drawGroundTile(scene, world, wx, wy, below, lightTint);
}
