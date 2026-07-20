// Places one tile-pack sprite (a packArt.ts pick) on a container — the pack-sheet
// counterpart to placeSprite.ts's 0x72-atlas placer. Pack tiles are native 48px,
// the same size as SCREEN_TILE_PX, so they draw at scale 1 (no upscale needed).
import type Phaser from "phaser";
import { bootTileCatalog } from "../../boot/tilePackManifest.js";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import type { PackTileFrame } from "./packArt.js";

/** 1 when the catalog's declared tile size already equals the world's on-screen tile size
 * (true today: both are 48px) — computed instead of hardcoded so a future catalog tilePx
 * change scales correctly instead of silently mis-sizing every pack sprite. */
const PACK_TILE_SCALE = SCREEN_TILE_PX / bootTileCatalog.tilePx;

export interface PlacePackTileOptions {
  readonly tint?: number;
  readonly angle?: number;
  readonly flipY?: boolean;
  readonly alpha?: number;
}

/** Adds a pack-sheet tile sprite, centered on (wx, wy), to `container`. */
export function placePackTile(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  wx: number,
  wy: number,
  tile: PackTileFrame,
  opts: PlacePackTileOptions = {},
): Phaser.GameObjects.Sprite {
  const cx = wx * SCREEN_TILE_PX + SCREEN_TILE_PX / 2;
  const cy = wy * SCREEN_TILE_PX + SCREEN_TILE_PX / 2;
  const sprite = scene.add.sprite(cx, cy, tile.textureKey, tile.frame);
  sprite.setOrigin(0.5, 0.5);
  sprite.setScale(PACK_TILE_SCALE);
  if (opts.tint !== undefined) sprite.setTint(opts.tint);
  if (opts.angle !== undefined) sprite.setAngle(opts.angle);
  if (opts.flipY) sprite.setFlipY(true);
  if (opts.alpha !== undefined) sprite.setAlpha(opts.alpha);
  container.add(sprite);
  return sprite;
}
