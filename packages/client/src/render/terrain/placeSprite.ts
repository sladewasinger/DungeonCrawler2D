// Shared tile-sprite placement: terrain sprites center on their tile (rotation
// pivots correctly), with variants for bottom-anchoring (pillars), flat fill
// rects (solid-rock interior), half-face cliff bands, and occlusion bands.
// Every placement function takes an optional `liftPx` (docs/ELEVATION-PROJECTION.md
// section 0/1): a scalar screen-Y offset SUBTRACTED after ordinary tile-position
// math, never folded into world coordinates — the one shift rule, applied at the
// lowest placement layer so every surface caller gets it for free. Pass
// `surfaceLiftPx(height)` (below): positive height subtracts (shifts screen-up);
// negative height (a pit/chasm floor) subtracts a negative number, i.e. shifts DOWN.
import type Phaser from "phaser";
import { ASSET_KEYS, SCREEN_TILE_PX, SOURCE_TILE_PX, WORLD_PIXEL_SCALE } from "../../boot/assetManifest.js";

/** Pixels to shift a terrain surface upward for height `h` — same `h*TILE` axis
 * as entities' `spriteLiftPx` (render/entities/lift.ts), just fed a cell's own
 * surface height instead of an entity's z. Negative height (pit/chasm floor)
 * yields a negative liftPx, i.e. shifts DOWN (spec worked example D). */
export function surfaceLiftPx(height: number): number {
  return height * SCREEN_TILE_PX;
}

export interface PlaceSpriteOptions {
  readonly tint?: number;
  readonly angle?: number;
  /** Vertical mirror — bottom edges reuse top dash art (the kit has no bottom-mid piece). */
  readonly flipY?: boolean;
  /** 1 = bottom-anchored on the tile's south edge (tall sprites like columns). */
  readonly originY?: number;
  /** Faint overlay ghosts (stair treads, depth texture) — defaults to fully opaque. */
  readonly alpha?: number;
  /** Screen-Y pixels to subtract after placement — see `surfaceLiftPx` above. */
  readonly liftPx?: number;
}

/** Adds a tile sprite (atlas frame, world-pixel-scaled) to `container`. */
export function placeSprite(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  wx: number,
  wy: number,
  frame: string,
  opts: PlaceSpriteOptions = {},
): Phaser.GameObjects.Sprite {
  const cx = wx * SCREEN_TILE_PX + SCREEN_TILE_PX / 2;
  const originY = opts.originY ?? 0.5;
  const cy = (originY === 1 ? (wy + 1) * SCREEN_TILE_PX : wy * SCREEN_TILE_PX + SCREEN_TILE_PX / 2) - (opts.liftPx ?? 0);
  const sprite = scene.add.sprite(cx, cy, ASSET_KEYS.atlas, frame);
  sprite.setOrigin(0.5, originY);
  sprite.setScale(WORLD_PIXEL_SCALE);
  if (opts.tint !== undefined) sprite.setTint(opts.tint);
  if (opts.angle !== undefined) sprite.setAngle(opts.angle);
  if (opts.flipY) sprite.setFlipY(true);
  if (opts.alpha !== undefined) sprite.setAlpha(opts.alpha);
  container.add(sprite);
  return sprite;
}

/**
 * A translucent rect covering a fractional slice of one tile (e.g. [1/3, 2/3]
 * on the Y axis for a horizontal stair-tread riser) — the same tile-anchored
 * math as placeFillRect/placeBottomBand, generalized to an arbitrary band on
 * either axis instead of a fixed bottom fraction.
 */
export function placeFractionalRect(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  wx: number,
  wy: number,
  xFrac: readonly [number, number],
  yFrac: readonly [number, number],
  color: number,
  alpha: number,
  liftPx = 0,
): void {
  const left = wx * SCREEN_TILE_PX + xFrac[0] * SCREEN_TILE_PX;
  const right = wx * SCREEN_TILE_PX + xFrac[1] * SCREEN_TILE_PX;
  const top = wy * SCREEN_TILE_PX + yFrac[0] * SCREEN_TILE_PX - liftPx;
  const bottom = wy * SCREEN_TILE_PX + yFrac[1] * SCREEN_TILE_PX - liftPx;
  const rect = scene.add.rectangle((left + right) / 2, (top + bottom) / 2, right - left, bottom - top, color, alpha);
  container.add(rect);
}

/** A flat filled rect covering one tile — the quiet treatment for solid-rock interior. */
export function placeFillRect(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  wx: number,
  wy: number,
  color: number,
  liftPx = 0,
): void {
  const cx = wx * SCREEN_TILE_PX + SCREEN_TILE_PX / 2;
  const cy = wy * SCREEN_TILE_PX + SCREEN_TILE_PX / 2 - liftPx;
  container.add(scene.add.rectangle(cx, cy, SCREEN_TILE_PX, SCREEN_TILE_PX, color, 1));
}

/**
 * The bottom half of a face frame drawn across the TOP half of tile (wx, wy) —
 * how a raised walkable platform to the north shows its cliff without stealing
 * this tile's floor. Implemented as a crop, so the face art stays pixel-true.
 */
export function placeHalfFaceBand(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  wx: number,
  wy: number,
  faceFrame: string,
  tint: number,
): void {
  const cx = wx * SCREEN_TILE_PX + SCREEN_TILE_PX / 2;
  const sprite = scene.add.sprite(cx, wy * SCREEN_TILE_PX, ASSET_KEYS.atlas, faceFrame);
  sprite.setOrigin(0.5, 0.5);
  sprite.setScale(WORLD_PIXEL_SCALE);
  sprite.setCrop(0, SOURCE_TILE_PX / 2, SOURCE_TILE_PX, SOURCE_TILE_PX / 2);
  sprite.setTint(tint);
  container.add(sprite);
}

/** A color band across the bottom `fraction` of a tile — the wall-cap occlusion overhang. */
export function placeBottomBand(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  wx: number,
  wy: number,
  color: number,
  alpha: number,
  fraction: number,
): void {
  const bandHeight = SCREEN_TILE_PX * fraction;
  const cx = wx * SCREEN_TILE_PX + SCREEN_TILE_PX / 2;
  const bottomY = (wy + 1) * SCREEN_TILE_PX;
  const rect = scene.add.rectangle(cx, bottomY - bandHeight / 2, SCREEN_TILE_PX, bandHeight, color, alpha);
  container.add(rect);
}
