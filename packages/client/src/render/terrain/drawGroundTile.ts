// Ground tile rendering: floor/void base, stair treads, platform cliff bands,
// edge lips, and single-tile props — everything that isn't wall terrain. Raised
// walkable ground keeps real floor art (never void): its elevation reads from the
// half-height cliff band on the tile below its south edge plus height shade.
import { TILE, type World } from "@dc2d/engine";
import type Phaser from "phaser";
import { edgeLipAngle } from "./edgeLip.js";
import { hasPlatformSouthFace } from "./faces.js";
import { floorFrame, isNearEdge } from "./floorFrame.js";
import { heightTint, isChasmDepth } from "./heightShade.js";
import { placeHalfFaceBand, placeSprite } from "./placeSprite.js";
import { propFrame } from "./propFrame.js";
import { stairAngle } from "./stairFrame.js";

const EDGE_LIP_TINT = 0x0a0a10;

export function drawGroundTile(
  scene: Phaser.Scene,
  world: World,
  wx: number,
  wy: number,
  below: Phaser.GameObjects.Container,
): void {
  const height = world.heightAt(wx, wy);
  const tile = world.tileAt(wx, wy);
  const tint = heightTint(height);

  const isEdgeNeighbor = (dx: number, dy: number): boolean =>
    world.tileAt(wx + dx, wy + dy) === TILE.Wall || isChasmDepth(world.heightAt(wx + dx, wy + dy));
  const base = isChasmDepth(height) ? "hole" : floorFrame(wx, wy, world.zoneAt(wx, wy), isNearEdge(isEdgeNeighbor));
  placeSprite(scene, below, wx, wy, base, { tint });

  // A raised walkable platform north of this tile shows its cliff band here, over
  // this tile's floor — the drop reads without stealing the whole lower cell.
  if (hasPlatformSouthFace(world, wx, wy - 1)) {
    placeHalfFaceBand(scene, below, wx, wy, "wall_mid", heightTint(world.heightAt(wx, wy - 1)));
  }

  if (tile === TILE.Stairs) {
    placeSprite(scene, below, wx, wy, "floor_stairs", { tint, angle: stairAngle(world, wx, wy) });
  }

  const lipAngle = edgeLipAngle(world, wx, wy);
  if (lipAngle !== null) {
    placeSprite(scene, below, wx, wy, "edge_down", { tint: EDGE_LIP_TINT, angle: lipAngle });
  }

  const prop = propFrame(tile);
  if (prop) placeSprite(scene, below, wx, wy, prop.frame, prop.tint !== undefined ? { tint: prop.tint } : {});
}
