// One-tile dispatch under the own-tile face model: face rows draw on the raised
// cells themselves (into the occluder row of their face's BOTTOM, so the whole
// face shares one depth); walls that aren't face are rim/pillar/fill; everything
// else is ground. Baked tile lighting multiplies into every layer here.
import { TILE } from "@dc2d/engine";
import type Phaser from "phaser";
import { drawGroundTile } from "./drawGroundTile.js";
import { drawWallTile } from "./drawWallTile.js";
import { floorFrame } from "./floorFrame.js";
import { heightTint, multiplyTint, WALL_FILL_COLOR } from "./heightShade.js";
import { ownFaceRowAt, type OwnFaceRow } from "./ownFace.js";
import { placeFillRect, placeSprite } from "./placeSprite.js";
import { tileKey, type StructureMap } from "./structures.js";
import type { TerrainWorld } from "./terrainWorld.js";
import type { LightField } from "./tileLight.js";

export type OccluderFor = (wy: number) => Phaser.GameObjects.Container;

/** Multiply shade per face row from its top (1) downward — depth reads as receding light. */
const FACE_ROW_SHADE = [0xffffff, 0xa8a8b4, 0x6a6a76] as const;
const TRUNCATED_ROW_SHADE = 0x30303a;

function faceFrame(world: TerrainWorld, wx: number, wy: number): string {
  const westFace = ownFaceRowAt(world, wx - 1, wy) !== null;
  const eastFace = ownFaceRowAt(world, wx + 1, wy) !== null;
  if (!westFace && eastFace) return "wall_left";
  if (westFace && !eastFace) return "wall_right";
  return "wall_mid";
}

function drawFaceCell(
  scene: Phaser.Scene,
  world: TerrainWorld,
  wx: number,
  wy: number,
  face: OwnFaceRow,
  occluderFor: OccluderFor,
  lightTint: number,
): void {
  const container = occluderFor(wy + face.distanceToGround - 1);
  const shade = face.truncated
    ? TRUNCATED_ROW_SHADE
    : (FACE_ROW_SHADE[face.rowFromTop - 1] ?? TRUNCATED_ROW_SHADE);
  const tint = multiplyTint(multiplyTint(heightTint(face.surfaceHeight), shade), lightTint);
  placeSprite(scene, container, wx, wy, faceFrame(world, wx, wy), { tint });
  // The pack's cap-dash line rides the face's top row, marking the surface edge.
  if (face.rowFromTop === 1) placeSprite(scene, container, wx, wy, "wall_top_mid", { tint });
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
    drawFaceCell(scene, world, wx, wy, face, occluderFor, lightTint);
    return;
  }
  if (world.tileAt(wx, wy) === TILE.Wall) {
    drawWallTile(scene, world, wx, wy, occluderFor(wy), lightTint);
    return;
  }
  drawGroundTile(scene, world, wx, wy, below, lightTint);
}
