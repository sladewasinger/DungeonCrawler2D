import { stairVisualAt, TILE, WALL_FACE_MIN_DROP } from "@dc2d/engine";
import type Phaser from "phaser";
import { southFaceColor } from "./drawWallTile.js";
import { VOID_SURFACE_COLOR } from "./heightShade.js";
import type { OwnFaceRow } from "./ownFace.js";
import { placeFractionalRect } from "./placeSprite.js";
import { screenClimbDirIndex } from "./stairScreenDirection.js";
import { steppedStairSurface } from "./steppedStairSurface.js";
import { stacksVertically } from "./stairTread.js";
import { hasVoidNeighborAt, isVoidCellAt } from "./faces.js";
import type { ViewTerrainWorld } from "./viewWorld.js";

/** True when a wall primitive projects into a horizontal stair's tread area. */
export function wallBehindHorizontalStair(
  world: ViewTerrainWorld,
  wx: number,
  wy: number,
  face: OwnFaceRow | null,
): boolean {
  const height = world.heightAt(wx, wy);
  const wallRanges: Array<readonly [number, number]> = [[wy - height, wy - height + 1]];
  if (face !== null) {
    const lowerHeight = world.heightAt(wx, wy + face.distanceToGround);
    wallRanges.push([wy - lowerHeight, wy - lowerHeight + 1]);
  }
  const firstStairRow = Math.floor(Math.min(...wallRanges.map((range) => range[0]))) - 1;
  for (let stairX = wx - 1; stairX <= wx + 1; stairX++) {
    for (let stairY = firstStairRow; stairY <= wy + 1; stairY++) {
      const real = world.toReal(stairX, stairY);
      const stair = stairVisualAt(world.real, real.x, real.y);
      if (!stair) continue;
      const direction = screenClimbDirIndex(stair.direction, world.orientation);
      if (stacksVertically(direction)) continue;
      const surface = steppedStairSurface(stairX, stairY, direction, (x, y) => world.groundAt(x, y));
      for (const band of surface.bands) {
        for (const stairFace of [band.floor, band.riser, band.tread]) {
          if (!stairFace) continue;
          const stairRange: readonly [number, number] = [
            stairY + stairFace.y[0] - band.height,
            stairY + stairFace.y[1] - band.height,
          ];
          if (wallRanges.some((wallRange) => rangesIntersect(wallRange, stairRange))) return true;
        }
      }
    }
  }
  return false;
}

/** Fill a raised Wall's continuous, edge-free volume behind cap/face layers. */
export function drawWallVolume(
  scene: Phaser.Scene,
  below: Phaser.GameObjects.Container,
  wx: number,
  wy: number,
  height: number,
): void {
  if (height <= 0) return;
  placeFractionalRect(scene, below, wx, wy, [0, 1], [-height, 1], VOID_SURFACE_COLOR, 1);
}

/** Fill smaller camera-facing height drops that do not receive whole-tile face bands. */
export function drawPartialHeightFace(
  scene: Phaser.Scene,
  below: Phaser.GameObjects.Container,
  world: ViewTerrainWorld,
  wx: number,
  wy: number,
  lightTint: number,
): void {
  if (world.tileAt(wx, wy) === TILE.Stairs || hasVoidNeighborAt(world, wx, wy) || isVoidCellAt(world, wx, wy) || isVoidCellAt(world, wx, wy + 1)) return;
  const height = world.heightAt(wx, wy);
  const southHeight = world.heightAt(wx, wy + 1);
  const drop = height - southHeight;
  if (drop <= 0.01 || drop >= WALL_FACE_MIN_DROP) return;
  placeFractionalRect(
    scene,
    below,
    wx,
    wy,
    [0, 1],
    [1 - height, 1 - southHeight],
    southFaceColor(lightTint),
    1,
  );
}

function rangesIntersect(a: readonly [number, number], b: readonly [number, number]): boolean {
  return a[0] < b[1] - 0.001 && b[0] < a[1] - 0.001;
}
