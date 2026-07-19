// One-tile dispatch: structure-suppressed cells draw only their floor (the
// assembly draws over them); wall terrain routes to the contour renderer;
// everything else is ground.
import { TILE, type World } from "@dc2d/engine";
import type Phaser from "phaser";
import { drawGroundTile } from "./drawGroundTile.js";
import { drawWallTile } from "./drawWallTile.js";
import { floorFrame } from "./floorFrame.js";
import { heightTint, WALL_FILL_COLOR } from "./heightShade.js";
import { placeFillRect, placeSprite } from "./placeSprite.js";
import { tileKey, type StructureMap } from "./structures.js";

export function drawTile(
  scene: Phaser.Scene,
  world: World,
  wx: number,
  wy: number,
  below: Phaser.GameObjects.Container,
  occluder: Phaser.GameObjects.Container,
  structures: StructureMap,
): void {
  if (structures.suppressed.has(tileKey(wx, wy))) {
    // The portal cell keeps floor under transparent door pixels. Suppressed wall
    // cells above retain only the quiet mass fill, never textured floor or caps.
    if (world.tileAt(wx, wy) === TILE.Wall) {
      placeFillRect(scene, occluder, wx, wy, WALL_FILL_COLOR);
    } else {
      placeSprite(scene, below, wx, wy, floorFrame(wx, wy, world.zoneAt(wx, wy), false), {
        tint: heightTint(world.heightAt(wx, wy)),
      });
    }
    return;
  }
  if (world.tileAt(wx, wy) === TILE.Wall) {
    drawWallTile(
      scene,
      world,
      wx,
      wy,
      occluder,
      (x, y) => structures.faceSuppressed.has(tileKey(x, y)),
    );
    return;
  }
  drawGroundTile(scene, world, wx, wy, below);
}
