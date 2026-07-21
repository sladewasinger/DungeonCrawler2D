// Occlusion silhouette: terrain whose art climbs north of its own base row (see
// render/terrain/chunkVisual.ts's occluder strips) can paint over an entity
// standing near it. This module detects that case and keeps a flat-tint duplicate
// of the sprite drawn above every layer that could be covering it, so a player never
// loses track of where they are (docs/ROADMAP.md: "Walk-behind + occlusion outline").
//
// WAVE R2 generalization (user playtest 2026-07-20, pit at z-1): occluders used to
// come only from WALL tiles — a z0 floor rim between the camera and a pit-dweller
// didn't occlude, so he read as standing ON the floor above instead of below it.
// The rule is the same one cliffMask.ts's outline consumer uses: ANY terrain
// higher than the entity, on the side the camera sits, occludes — floor rims
// exactly like walls. "The side the camera sits" is screen-south, which rotates
// with the view (screenSouthWorldDirection); the height math itself stays plain
// world-space data, same as cliffMask.ts.
//
// WAVE E3 (docs/ELEVATION-PROJECTION.md section 3): under the shift, a cell's drawn
// body reaches exactly `height` rows north of its own row (the cap shifts screen-up
// by `height*TILE`, same math as the face band it caps). So the test is now EXACT,
// no fudge margin: a step-k neighbor occludes iff its height clears the entity's own
// z by at least k. The old 2-row cap + 0.5 margin was itself already numerically
// equivalent to this for every case this file's tests exercised (`step - 1 + 0.5 ==
// step - 0.5`, which only differs from `step` at fractional heights no fixture used)
// — this rewrite just makes the true rule explicit and removes the hidden coincidence.
//
// The duplicate is stored on the body sprite's own Phaser data store rather than a new
// field on PlayerVisual (state.ts is a different lane's file) and self-destroys off the
// body's "destroy" event, so callers don't need a teardown hook either.
import type { WorldView } from "@dc2d/engine";
import type Phaser from "phaser";
import { ASSET_KEYS, SCREEN_TILE_PX, WORLD_PIXEL_SCALE } from "../../boot/assetManifest.js";
import { screenSouthWorldDirection, type CompassDir } from "../view/directionRemap.js";
import type { ViewOrientation } from "../view/viewOrientation.js";
import { worldTileToView } from "../view/viewTransform.js";
import { depthForOccluder } from "./depthSort.js";

const GHOST_DATA_KEY = "occlusionGhost";
const GHOST_TINT = 0xe4e4e4;
const GHOST_ALPHA = 0.42;
/**
 * Search ceiling for how many rows ahead a tall occluder could still reach: mirrors
 * `render/terrain/ownFace.ts`'s `MAX_FACE_ROWS` (not imported directly — that module
 * lives in the terrain layer, which itself depends on `render/view`, and this file
 * sits beside `render/view`'s own consumers; duplicating the one constant keeps the
 * dependency direction one-way). No drawn cap/face ever climbs higher than that
 * budget, so no cell taller than it could occlude further north than this many rows
 * regardless — see docs/ASSUMPTIONS.md row 320. Also bounds the loop when `z` is very
 * negative (a deep-pit dweller), where even flat ground could otherwise satisfy the
 * exact test at implausibly large `step`.
 */
const MAX_OCCLUDING_ROWS_AHEAD = 16;

/** Real-world (dx, dy) unit step for one tile toward each compass direction — north
 * is -y per the engine's convention (stairFrame.ts's NEIGHBORS table). */
const WORLD_STEP: Record<CompassDir, { dx: number; dy: number }> = {
  N: { dx: 0, dy: -1 },
  S: { dx: 0, dy: 1 },
  E: { dx: 1, dy: 0 },
  W: { dx: -1, dy: 0 },
};

export interface TerrainOcclusion {
  /** The world-pixel Y where the terrain face begins. Everything below this point is hidden. */
  readonly screenY: number;
}

/** Finds the foremost terrain face that actually crosses the entity's row. The returned
 * screen-space seam is used to crop the ghost duplicate to the exact hidden portion;
 * this is deliberately richer than a boolean because an all-or-nothing duplicate makes
 * an unobscured head read as a ghost as well. */
export function terrainOcclusionAhead(
  world: WorldView,
  x: number,
  y: number,
  z: number,
  orientation: ViewOrientation,
): TerrainOcclusion | null {
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  const { dx, dy } = WORLD_STEP[screenSouthWorldDirection(orientation)];
  let closestSeamY = Number.POSITIVE_INFINITY;
  for (let step = 1; step <= MAX_OCCLUDING_ROWS_AHEAD; step++) {
    const checkX = tileX + dx * step;
    const checkY = tileY + dy * step;
    const height = world.heightAt(checkX, checkY);
    if (height - z < step) continue;
    const viewTile = worldTileToView({ x: checkX, y: checkY }, orientation);
    closestSeamY = Math.min(closestSeamY, (viewTile.y - height) * SCREEN_TILE_PX);
  }
  return Number.isFinite(closestSeamY) ? { screenY: closestSeamY } : null;
}

/** True when terrain toward the camera (screen-south) of (x, y) stands tall enough
 * that its rendered body actually reaches this sprite's row. Under the elevation
 * shift (docs/ELEVATION-PROJECTION.md section 3) a cell's body — cap and face band
 * alike — extends screen-up by exactly its own height, so a tile `step` rows ahead
 * covers this row iff `heightAt(ahead) - z >= step`, EXACTLY (no margin term). Any
 * terrain counts, not just walls — a walkable floor rim occludes exactly like a wall
 * face would (WAVE R2). `orientation` picks which real world direction is currently
 * screen-south (directionRemap.ts), so the check reads through the same seam as every
 * other neighbor-direction decision in this lane. */
export function isOccludedByTerrainAhead(
  world: WorldView,
  x: number,
  y: number,
  z: number,
  orientation: ViewOrientation,
): boolean {
  return terrainOcclusionAhead(world, x, y, z, orientation) !== null;
}

/** Depth guaranteed above any occluder strip that could plausibly cover a sprite whose
 * feet sit in row `tileY` (see chunkVisual.ts's per-row occluder bake). */
function ghostDepth(tileY: number): number {
  return depthForOccluder(tileY + MAX_OCCLUDING_ROWS_AHEAD + 1) + 1;
}

/** Lazily creates a neutral duplicate of `body`, then crops it to just the part covered
 * by terrain. The normal body remains at its usual depth, so its visible portion keeps
 * its real sprite colors; only the hidden portion is lifted above the terrain. */
export function syncOcclusionSilhouette(
  body: Phaser.GameObjects.Sprite,
  worldY: number,
  occlusion: TerrainOcclusion | null,
): void {
  // Phaser's DataManager is untyped by design; this key is only ever written/read here.
  const existing = body.getData(GHOST_DATA_KEY) as Phaser.GameObjects.Sprite | undefined;
  if (occlusion === null) {
    existing?.setVisible(false);
    return;
  }
  const ghost = existing ?? createGhost(body);
  ghost.setPosition(body.x, body.y);
  if (body.frame.name !== ghost.frame.name) ghost.setFrame(body.frame.name);
  ghost.setFlipX(body.flipX);
  ghost.setScale(body.scaleX, body.scaleY);
  ghost.setAngle(body.angle);
  const bodyTop = body.y - body.displayHeight;
  const displayCropTop = Math.min(body.displayHeight, Math.max(0, occlusion.screenY - bodyTop));
  const sourceHeight = ghost.frame.height;
  const sourceCropTop = Math.min(sourceHeight, displayCropTop / Math.abs(body.scaleY));
  if (sourceCropTop >= sourceHeight) {
    ghost.setVisible(false);
    return;
  }
  if (sourceCropTop <= 0) ghost.setCrop();
  else ghost.setCrop(0, sourceCropTop, ghost.frame.width, sourceHeight - sourceCropTop);
  ghost.setVisible(true);
  ghost.setDepth(ghostDepth(Math.floor(worldY)));
}

function createGhost(body: Phaser.GameObjects.Sprite): Phaser.GameObjects.Sprite {
  const ghost = body.scene.add
    .sprite(0, 0, ASSET_KEYS.atlas)
    .setOrigin(0.5, 1)
    .setScale(WORLD_PIXEL_SCALE)
    .setTintFill(GHOST_TINT)
    .setAlpha(GHOST_ALPHA);
  body.setData(GHOST_DATA_KEY, ghost);
  body.once("destroy", () => ghost.destroy());
  return ghost;
}
