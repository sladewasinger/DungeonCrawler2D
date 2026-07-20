// Occlusion silhouette: a wall's cap art bleeds up to ROW_OVERHANG_TILES rows north of
// its own tile (render/terrain/chunkVisual.ts), which can paint over an entity walking
// through that stretch. This module detects that case and keeps a flat-tint duplicate
// of the sprite drawn above every layer that could be covering it, so a player never
// loses track of where they are (docs/ROADMAP.md: "Walk-behind + occlusion outline").
//
// The duplicate is stored on the body sprite's own Phaser data store rather than a new
// field on PlayerVisual (state.ts is a different lane's file) and self-destroys off the
// body's "destroy" event, so callers don't need a teardown hook either.
import type { WorldView } from "@dc2d/engine";
import type Phaser from "phaser";
import { ASSET_KEYS, WORLD_PIXEL_SCALE } from "../../boot/assetManifest.js";
import { depthForOccluder } from "./depthSort.js";

const GHOST_DATA_KEY = "occlusionGhost";
/** A saturated "spirit" cyan, deliberately far from any sprite's natural palette so the
 * silhouette always reads as an overlay effect, never as a lighting coincidence. */
const GHOST_TINT = 0x4fd6ff;
const GHOST_ALPHA = 0.75;
/** Mirrors chunkVisual.ts's ROW_OVERHANG_TILES: a wall's cap art bleeds up to this many
 * rows north of its own tile, covering entities standing there. */
const OCCLUDING_ROWS_SOUTH = 2;
/** A nearby solid tile must clear the entity's own height by this much to read as a
 * covering wall face rather than flush terrain underfoot. */
const OCCLUSION_HEIGHT_MARGIN = 0.5;

/** True when a solid tile south of (x, y) stands tall enough that its rendered
 * body actually reaches this sprite's row: a wall's art extends north of its base
 * by its HEIGHT, so a wall dy rows south only covers you when height - z >= dy.
 * (The old >= 0.5-for-any-dy check ghost-tinted players standing fully in the
 * open two rows north of an ordinary z1 wall — user screenshot 2026-07-20.) */
export function isOccludedByWallAhead(world: WorldView, x: number, y: number, z: number): boolean {
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  for (let dy = 1; dy <= OCCLUDING_ROWS_SOUTH; dy++) {
    const wallY = tileY + dy;
    if (world.isWalkable(tileX, wallY)) continue;
    if (world.heightAt(tileX, wallY) - z >= dy - 1 + OCCLUSION_HEIGHT_MARGIN) return true;
  }
  return false;
}

/** Depth guaranteed above any occluder strip that could plausibly cover a sprite whose
 * feet sit in row `tileY` (see chunkVisual.ts's per-row occluder bake). */
function ghostDepth(tileY: number): number {
  return depthForOccluder(tileY + OCCLUDING_ROWS_SOUTH + 1) + 1;
}

/** Lazily creates a flat-tint duplicate of `body` and keeps it synced, visible only
 * while `occluded`. `worldY` is the entity's feet position, used to depth the ghost
 * above whatever terrain could be covering it. */
export function syncOcclusionSilhouette(body: Phaser.GameObjects.Sprite, worldY: number, occluded: boolean): void {
  // Phaser's DataManager is untyped by design; this key is only ever written/read here.
  const existing = body.getData(GHOST_DATA_KEY) as Phaser.GameObjects.Sprite | undefined;
  if (!occluded) {
    existing?.setVisible(false);
    return;
  }
  const ghost = existing ?? createGhost(body);
  ghost.setVisible(true);
  ghost.setPosition(body.x, body.y);
  ghost.setFlipX(body.flipX);
  if (body.frame.name !== ghost.frame.name) ghost.setFrame(body.frame.name);
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
