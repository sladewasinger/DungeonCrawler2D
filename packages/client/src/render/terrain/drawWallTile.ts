// Non-face wall cells: every visible wall pixel is the debug tileset's purple-gray
// tile with a black border baked exactly where autotile.ts's bitmask says this cell's
// cardinal neighbor is NOT also wall, plus the 8-bit inner-corner refinement dots —
// so a connectivity mistake anywhere in the mask math shows up as a wrong border, the
// whole point of this lane. Face rows (the own-tile face model) draw the same wall
// material through drawTile.ts's drawFaceCell instead; this module only ever sees
// wall cells that are NOT currently rendering as someone's face row.
import type Phaser from "phaser";
import { pickWallFrame, wallAutotileAt } from "./debugArt.js";
import { placeDebugTile, placeWallCornerDots } from "./debugSprite.js";
import { heightTint, multiplyTint } from "./heightShade.js";
import type { TerrainWorld } from "./terrainWorld.js";

export function drawWallTile(
  scene: Phaser.Scene,
  world: TerrainWorld,
  wx: number,
  wy: number,
  occluder: Phaser.GameObjects.Container,
  lightTint: number,
): void {
  const tint = multiplyTint(heightTint(world.heightAt(wx, wy)), lightTint);
  const { mask4, corners } = wallAutotileAt(world, wx, wy);
  placeDebugTile(scene, occluder, wx, wy, pickWallFrame(mask4), { tint });
  placeWallCornerDots(scene, occluder, wx, wy, corners);
}
