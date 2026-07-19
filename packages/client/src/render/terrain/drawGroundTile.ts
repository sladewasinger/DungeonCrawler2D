// Ground tile rendering: floor/void base, stair treads, cap-dash edges, and
// single-tile props — everything that isn't a face row or wall cell. Raised
// walkable tops keep real floor art; their south edges carry the cap-dash line
// where a face row starts below them. Baked tile lighting shades every layer.
import { TILE } from "@dc2d/engine";
import type Phaser from "phaser";
import { floorFrame, isNearEdge } from "./floorFrame.js";
import { heightTint, isChasmDepth, multiplyTint } from "./heightShade.js";
import { hasCapDashSouth } from "./ownFace.js";
import { placeSprite } from "./placeSprite.js";
import { propFrame } from "./propFrame.js";
import { stairAngle } from "./stairFrame.js";
import type { TerrainWorld } from "./terrainWorld.js";

export function drawGroundTile(
  scene: Phaser.Scene,
  world: TerrainWorld,
  wx: number,
  wy: number,
  below: Phaser.GameObjects.Container,
  lightTint: number,
): void {
  const height = world.heightAt(wx, wy);
  const tile = world.tileAt(wx, wy);
  const tint = multiplyTint(heightTint(height), lightTint);

  const isEdgeNeighbor = (dx: number, dy: number): boolean =>
    world.tileAt(wx + dx, wy + dy) === TILE.Wall || isChasmDepth(world.heightAt(wx + dx, wy + dy));
  const base = isChasmDepth(height) ? "hole" : floorFrame(wx, wy, world.zoneAt(wx, wy), isNearEdge(isEdgeNeighbor));
  placeSprite(scene, below, wx, wy, base, { tint });

  if (hasCapDashSouth(world, wx, wy)) {
    placeSprite(scene, below, wx, wy, "wall_top_mid", { tint });
  }

  if (tile === TILE.Stairs) {
    placeSprite(scene, below, wx, wy, "floor_stairs", { tint, angle: stairAngle(world, wx, wy) });
  }

  const prop = propFrame(tile);
  if (prop) placeSprite(scene, below, wx, wy, prop.frame, prop.tint !== undefined ? { tint: prop.tint } : {});
}
