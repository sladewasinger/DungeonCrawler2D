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
import { TILE } from "@dc2d/engine";
import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { placeWallEdges } from "./debugSprite.js";
import type { CardinalEdges } from "./autotile.js";
import { multiplyTint, VOID_SURFACE_COLOR } from "./heightShade.js";
import { freestandingHeightBodyRows } from "./heightColumn.js";
import { MAX_FACE_ROWS, ownFaceRowAt } from "./ownFace.js";
import { pitFaceRowAt, pitStepFaceRowsAt } from "./pitFace.js";
import { placeFillRect } from "./placeSprite.js";
import type { TerrainRead } from "./faces.js";
import type { TerrainWorld } from "./terrainWorld.js";

export function hasWallMaterialAtScreen(world: TerrainRead, wx: number, screenY: number): boolean {
  const minSourceY = Math.floor(screenY) - MAX_FACE_ROWS;
  const maxSourceY = Math.ceil(screenY) + MAX_FACE_ROWS;
  for (let sourceY = minSourceY; sourceY <= maxSourceY; sourceY++) {
    const face = ownFaceRowAt(world, wx, sourceY);
    if (face !== null && Math.abs(sourceY - world.heightAt(wx, sourceY + face.distanceToGround) - screenY) < 0.01) return true;
    if (pitFaceRowAt(world, wx, sourceY) !== null && Math.abs(sourceY - screenY) < 0.01) return true;
    if (pitStepFaceRowsAt(world, wx, sourceY).some((row) => Math.abs(row.screenY - screenY) < 0.01)) return true;
    if (freestandingHeightBodyRows(world, wx, sourceY).some((row) => Math.abs(sourceY - row - screenY) < 0.01)) return true;
    if (world.tileAt(wx, sourceY) === TILE.Wall && Math.abs(sourceY - world.heightAt(wx, sourceY) - screenY) < 0.01) return true;
  }
  return false;
}

function voidEdgesAt(world: TerrainWorld, wx: number, wy: number, liftPx: number) {
  const screenY = wy - liftPx / SCREEN_TILE_PX;
  return {
    north: !hasWallMaterialAtScreen(world, wx, screenY - 1),
    east: !hasWallMaterialAtScreen(world, wx + 1, screenY),
    south: !hasWallMaterialAtScreen(world, wx, screenY + 1),
    west: !hasWallMaterialAtScreen(world, wx - 1, screenY),
  };
}

const PIT_FACE_SHADE_COLOR = 0x05050b;
const SOUTH_FACE_COLOR = 0x4a4a70;

export interface PitFaceShade {
  readonly rowFromTop: number;
  readonly totalRows: number;
  readonly truncated: boolean;
  readonly isStep: boolean;
}

/** One uniform purple material for an exposed south-facing wall. AO can darken a pit
 * face afterwards, but height rows must never become separately shaded tiles. */
export function southFaceColor(lightTint = 0xffffff): number {
  return multiplyTint(SOUTH_FACE_COLOR, lightTint);
}

/** Alpha at a fractional point down one continuous pit face, not inside a single
 * tile. Adjacent face rows meet at the same alpha, so a deep drop reads as one
 * gradient instead of a stack of miniature gradients. */
export function pitFaceGradientAlpha(depth: number, truncated: boolean): number {
  const base = 0.08 + Math.min(1, Math.max(0, depth)) * 0.42;
  return Math.min(0.62, base + (truncated ? 0.08 : 0));
}

function drawPitFaceShade(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  wx: number,
  wy: number,
  liftPx: number,
  shade: PitFaceShade,
): void {
  if (shade.isStep && shade.totalRows === 1) {
    const flat = scene.add.rectangle(
      wx * SCREEN_TILE_PX + SCREEN_TILE_PX / 2,
      wy * SCREEN_TILE_PX + SCREEN_TILE_PX / 2 - liftPx,
      SCREEN_TILE_PX,
      SCREEN_TILE_PX,
      PIT_FACE_SHADE_COLOR,
      0.12,
    );
    container.add(flat);
    return;
  }
  const topDepth = (shade.rowFromTop - 1) / shade.totalRows;
  const bottomDepth = shade.rowFromTop / shade.totalRows;
  const topAlpha = pitFaceGradientAlpha(topDepth, shade.truncated);
  const bottomAlpha = pitFaceGradientAlpha(bottomDepth, shade.truncated);
  const graphics = scene.add.graphics();
  graphics.fillGradientStyle(
    PIT_FACE_SHADE_COLOR,
    PIT_FACE_SHADE_COLOR,
    PIT_FACE_SHADE_COLOR,
    PIT_FACE_SHADE_COLOR,
    topAlpha,
    topAlpha,
    bottomAlpha,
    bottomAlpha,
  );
  graphics.fillRect(wx * SCREEN_TILE_PX, wy * SCREEN_TILE_PX - liftPx, SCREEN_TILE_PX, SCREEN_TILE_PX);
  container.add(graphics);
}

export function drawWallTile(
  scene: Phaser.Scene,
  world: TerrainWorld,
  wx: number,
  wy: number,
  container: Phaser.GameObjects.Container,
  liftPx = 0,
  pitFaceShade?: PitFaceShade,
  edgeOverrides: Partial<CardinalEdges> = {},
  materialColor = VOID_SURFACE_COLOR,
): void {
  placeFillRect(scene, container, wx, wy, materialColor, liftPx);
  if (pitFaceShade) drawPitFaceShade(scene, container, wx, wy, liftPx, pitFaceShade);
  placeWallEdges(scene, container, wx, wy, { ...voidEdgesAt(world, wx, wy, liftPx), ...edgeOverrides }, liftPx);
}
