// One-tile dispatch: structure-suppressed cells draw only their floor (the
// assembly draws over them); wall terrain routes to the contour renderer;
// everything else is ground.
import { TILE, type World } from "@dc2d/engine";
import type Phaser from "phaser";
import { drawGroundTile } from "./drawGroundTile.js";
import { drawWallTile } from "./drawWallTile.js";
import { floorFrame } from "./floorFrame.js";
import { heightTint } from "./heightShade.js";
import { placeSprite } from "./placeSprite.js";
import { tileKey, type StructureMap } from "./structures.js";

export function drawTile(
  scene: Phaser.Scene,
  world: World,
  wx: number,
  wy: number,
  below: Phaser.GameObjects.Container,
  above: Phaser.GameObjects.Container,
  structures: StructureMap,
): void {
  if (structures.suppressed.has(tileKey(wx, wy))) {
    // Plain floor beneath the assembly — visible through the doorway's transparent
    // pixels; no wall art, no props, nothing else may draw on these cells.
    placeSprite(scene, below, wx, wy, floorFrame(wx, wy, world.zoneAt(wx, wy), false), {
      tint: heightTint(world.heightAt(wx, wy)),
    });
    return;
  }
  if (world.tileAt(wx, wy) === TILE.Wall) {
    drawWallTile(scene, world, wx, wy, below, above);
    return;
  }
  drawGroundTile(scene, world, wx, wy, below);
}
