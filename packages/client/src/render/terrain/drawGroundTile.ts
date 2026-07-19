// Ground tile rendering: floor/void base, stair treads, platform cliff bands,
// edge lips, and single-tile props — everything that isn't wall terrain. Raised
// walkable ground keeps real floor art (never void): its elevation reads from the
// half-height cliff band on the tile below its south edge plus height shade.
import { TILE } from "@dc2d/engine";
import type { TerrainWorld } from "./terrainWorld.js";
import type Phaser from "phaser";
import { edgeLipAngle } from "./edgeLip.js";
import { floorFrame, isNearEdge } from "./floorFrame.js";
import { groundFaceRowAt, hasSouthCapDash } from "./groundFaces.js";
import { heightTint, isChasmDepth } from "./heightShade.js";
import { placeSprite } from "./placeSprite.js";
import { propFrame } from "./propFrame.js";
import { stairAngle } from "./stairFrame.js";

const EDGE_LIP_TINT = 0x0a0a10;
/** Multiply factors darkening successive face rows — deeper reads as further from light. */
const FACE_ROW_SHADE = [0xffffff, 0x9a9aa8, 0x5c5c68] as const;
const TRUNCATED_ROW_SHADE = 0x2a2a34;

function drawFaceRow(
  scene: Phaser.Scene,
  below: Phaser.GameObjects.Container,
  wx: number,
  wy: number,
  faceRow: NonNullable<ReturnType<typeof groundFaceRowAt>>,
): void {
  const shade = faceRow.truncated
    ? TRUNCATED_ROW_SHADE
    : (FACE_ROW_SHADE[faceRow.rowIndex - 1] ?? TRUNCATED_ROW_SHADE);
  placeSprite(scene, below, wx, wy, "wall_mid", {
    tint: multiplyTint(heightTint(faceRow.sourceHeight), shade),
  });
}

/** Channel-wise multiply of two tints (same math heightShade uses internally). */
function multiplyTint(a: number, b: number): number {
  const mul = (x: number, y: number) => Math.round((((x >> 0) & 0xff) / 255) * (((y >> 0) & 0xff) / 255) * 255);
  return (
    (mul((a >> 16) & 0xff, (b >> 16) & 0xff) << 16) |
    (mul((a >> 8) & 0xff, (b >> 8) & 0xff) << 8) |
    mul(a & 0xff, b & 0xff)
  );
}

export function drawGroundTile(
  scene: Phaser.Scene,
  world: TerrainWorld,
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

  // A raised walkable surface to the north casts stacked, depth-shaded brick
  // face rows over this lower cell — the unified height-derived cliff.
  const faceRow = groundFaceRowAt(world, wx, wy);
  if (faceRow) drawFaceRow(scene, below, wx, wy, faceRow);
  // The raised top's own south edge carries the pack's cap-dash line.
  if (hasSouthCapDash(world, wx, wy)) {
    placeSprite(scene, below, wx, wy, "wall_top_mid", { tint });
  }

  if (tile === TILE.Stairs) {
    placeSprite(scene, below, wx, wy, "floor_stairs", { tint, angle: stairAngle(world, wx, wy) });
  }

  const lipAngle = edgeLipAngle(world, wx, wy);
  if (lipAngle !== null && !faceRow) {
    placeSprite(scene, below, wx, wy, "edge_down", { tint: EDGE_LIP_TINT, angle: lipAngle });
  }

  const prop = propFrame(tile);
  if (prop) placeSprite(scene, below, wx, wy, prop.frame, prop.tint !== undefined ? { tint: prop.tint } : {});
}
