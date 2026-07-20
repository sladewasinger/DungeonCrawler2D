// Non-face wall cells: contour rims over quiet fill, textured ridge tops, and
// freestanding pillars. Face rows moved to the own-tile model in drawTile.ts —
// by the time a wall cell reaches here it is interior/top geometry only.
import { TILE } from "@dc2d/engine";
import type Phaser from "phaser";
import { floorFrame } from "./floorFrame.js";
import { heightTint, multiplyTint, WALL_FILL_COLOR } from "./heightShade.js";
import { placeFillRect, placeSprite } from "./placeSprite.js";
import { classifyWallCell, type WallRole } from "./wallContour.js";
import type { TerrainWorld } from "./terrainWorld.js";

// A "fill" cell (wallContour's own doc: quiet interior mass) always has zero
// open ORTHOGONAL or DIAGONAL neighbor by construction — the rim/diagonal
// checks that would otherwise classify it already ran first. So a small
// embedded rock formation surrounded by open floor (the "black rectangular
// void inside a room" repro, wave95 round 2) reads 100% identical to acres
// of untouched cave rock: same flat WALL_FILL_COLOR, zero cue it has any
// volume at all. Looking one ring further out (the 16 cells at Chebyshev
// distance 2) tells the two apart — a small formation's fill cells almost
// all border open ground just past their own immediate wall neighbors.
const RING2_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2],
  [-2, -1], [2, -1],
  [-2, 0], [2, 0],
  [-2, 1], [2, 1],
  [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2],
]; // prettier-ignore

/** True once every cell 2 rings out is also wall — genuinely deep mass, not a small embedded formation. */
function isDeepFillInterior(solid: (dx: number, dy: number) => boolean): boolean {
  return RING2_OFFSETS.every(([dx, dy]) => solid(dx, dy));
}

const FILL_NEAR_EDGE_COLOR = 0x18181f;
const FILL_GHOST_ALPHA = 0.16;

const WALL_TOP_TINT = 0x505064;

type RimRole = Extract<WallRole, { kind: "rim" }>;

const CORNER_NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

function placeCornerSurface(
  scene: Phaser.Scene,
  world: TerrainWorld,
  wx: number,
  wy: number,
  target: Phaser.GameObjects.Container,
  lightTint: number,
): void {
  const bordersSanctuary = CORNER_NEIGHBORS.some(
    ([dx, dy]) => world.tileAt(wx + dx, wy + dy) !== TILE.Wall && world.isSanctuary(wx + dx, wy + dy),
  );
  if (bordersSanctuary) {
    placeFillRect(scene, target, wx, wy, WALL_FILL_COLOR);
    return;
  }
  placeSprite(scene, target, wx, wy, floorFrame(wx, wy, world.zoneAt(wx, wy), false), {
    tint: multiplyTint(heightTint(world.heightAt(wx, wy)), lightTint),
  });
}

function drawRimRole(
  scene: Phaser.Scene,
  world: TerrainWorld,
  wx: number,
  wy: number,
  occluder: Phaser.GameObjects.Container,
  role: RimRole,
  tint: number,
  lightTint: number,
): void {
  if (!role.art.opaque) {
    if (role.art.groundFill) placeCornerSurface(scene, world, wx, wy, occluder, lightTint);
    else if (role.art.texturedFill)
      placeSprite(scene, occluder, wx, wy, "floor_5", { tint: multiplyTint(WALL_TOP_TINT, lightTint) });
    else placeFillRect(scene, occluder, wx, wy, WALL_FILL_COLOR);
  }
  placeSprite(scene, occluder, wx, wy, role.art.frame, {
    tint,
    ...(role.art.flip ? { flipY: true } : {}),
  });
  if (role.art.capNorth) placeSprite(scene, occluder, wx, wy, "wall_top_mid", { tint, flipY: true });
  if (role.art.capSouth) placeSprite(scene, occluder, wx, wy, "wall_top_mid", { tint });
  if (role.art.capEast) placeSprite(scene, occluder, wx, wy, "wall_edge_mid_right", { tint });
}

export function drawWallTile(
  scene: Phaser.Scene,
  world: TerrainWorld,
  wx: number,
  wy: number,
  occluder: Phaser.GameObjects.Container,
  lightTint: number,
): void {
  const tint = multiplyTint(heightTint(world.heightAt(wx, wy)), lightTint);
  const solid = (dx: number, dy: number): boolean => world.tileAt(wx + dx, wy + dy) === TILE.Wall;
  const role = classifyWallCell(solid, false, () => false);

  switch (role.kind) {
    case "pillar":
      // Freestanding obstacle: never wall-run art. Row sorting handles pass-behind.
      placeSprite(scene, occluder, wx, wy, "column", { tint, originY: 1 });
      return;
    case "rim":
      drawRimRole(scene, world, wx, wy, occluder, role, tint, lightTint);
      return;
    case "fill":
      placeFillRect(scene, occluder, wx, wy, isDeepFillInterior(solid) ? WALL_FILL_COLOR : FILL_NEAR_EDGE_COLOR);
      placeSprite(scene, occluder, wx, wy, "wall_mid", { tint, alpha: FILL_GHOST_ALPHA });
      return;
    case "face":
      // Unreachable: faces are decided in drawTile via ownFaceRowAt. Draw fill
      // so a logic slip is visible as a quiet block, never a crash.
      placeFillRect(scene, occluder, wx, wy, WALL_FILL_COLOR);
      return;
  }
}
