// Non-face wall cells: every visible wall pixel is the debug tileset's purple-gray
// tile with a black border baked exactly where autotile.ts's bitmask says this cell's
// cardinal neighbor is NOT also wall, plus the 8-bit inner-corner refinement dots —
// so a connectivity mistake anywhere in the mask math shows up as a wrong border, the
// whole point of this lane. Face rows (the own-tile face model) draw the same wall
// material through drawTile.ts's drawFaceCell instead; this module only ever sees
// wall cells that are NOT currently rendering as someone's face row — a solid rock
// mass that never faces any lower ground within scan range (drawTile.ts's dispatch
// already resolved `container` for its cell's own height before calling here, and
// `liftPx` shifts this cell's cap the same as any other surface —
// docs/ELEVATION-PROJECTION.md's "one shift rule" — so a same-height wall plateau
// stays seamless with itself wherever it eventually does meet a drop).
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
  container: Phaser.GameObjects.Container,
  lightTint: number,
  liftPx = 0,
): void {
  const tint = multiplyTint(heightTint(world.heightAt(wx, wy)), lightTint);
  const { mask4, corners } = wallAutotileAt(world, wx, wy);
  placeDebugTile(scene, container, wx, wy, pickWallFrame(mask4), { tint, liftPx });
  placeWallCornerDots(scene, container, wx, wy, corners, liftPx);
}
