// Places one debug-tileset frame on a container (packSprite.ts's counterpart for the
// debug art path), plus the inner-corner refinement dots the autotile module's 8-bit
// corner solve calls for — drawn as generic small rects (edgeLine.ts's own convention:
// pack-agnostic overlay geometry, not baked sprite variants) rather than combinatorially
// baking every corner combination into the spritesheet.
import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import type { InnerCorners } from "./autotile.js";
import { DEBUG_TILE_PX, DEBUG_TILESET_KEY } from "./debugTileset.js";
import { placeFractionalRect } from "./placeSprite.js";

/** 1 when the debug tileset's native tile size already equals the world's on-screen tile size. */
const DEBUG_TILE_SCALE = SCREEN_TILE_PX / DEBUG_TILE_PX;

export interface PlaceDebugTileOptions {
  readonly tint?: number;
  readonly alpha?: number;
  /** Screen-Y pixels to subtract after placement (docs/ELEVATION-PROJECTION.md's one shift rule) — see placeSprite.ts's `surfaceLiftPx`. */
  readonly liftPx?: number;
}

/** Adds a debug-tileset frame, centered on (wx, wy), to `container`. */
export function placeDebugTile(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  wx: number,
  wy: number,
  frame: number,
  opts: PlaceDebugTileOptions = {},
): Phaser.GameObjects.Sprite {
  const cx = wx * SCREEN_TILE_PX + SCREEN_TILE_PX / 2;
  const cy = wy * SCREEN_TILE_PX + SCREEN_TILE_PX / 2 - (opts.liftPx ?? 0);
  const sprite = scene.add.sprite(cx, cy, DEBUG_TILESET_KEY, frame);
  sprite.setOrigin(0.5, 0.5);
  sprite.setScale(DEBUG_TILE_SCALE);
  if (opts.tint !== undefined) sprite.setTint(opts.tint);
  if (opts.alpha !== undefined) sprite.setAlpha(opts.alpha);
  container.add(sprite);
  return sprite;
}

/** Fraction of a tile's width/height a corner dot covers, on each axis. */
const CORNER_DOT_FRAC = 1 / 6;

const CORNER_RECT: Readonly<
  Record<keyof InnerCorners, { readonly x: readonly [number, number]; readonly y: readonly [number, number] }>
> = {
  ne: { x: [1 - CORNER_DOT_FRAC, 1], y: [0, CORNER_DOT_FRAC] },
  se: { x: [1 - CORNER_DOT_FRAC, 1], y: [1 - CORNER_DOT_FRAC, 1] },
  sw: { x: [0, CORNER_DOT_FRAC], y: [1 - CORNER_DOT_FRAC, 1] },
  nw: { x: [0, CORNER_DOT_FRAC], y: [0, CORNER_DOT_FRAC] },
};

/** Pure black, always — matches the baked border tiles' own black exactly regardless of
 * height/light tint (this is an overlay rect, not a tinted sprite, so it needs its own
 * real color rather than a multiply factor). */
const CORNER_DOT_COLOR = 0x000000;

/** Draws a small black dot at every inner corner `corners` flags — the 8-bit refinement
 * over the 16-variant baked border, so a concave notch (both cardinals wall, diagonal not) shows up even though neither of this tile's own edges carries a border there. */
export function placeWallCornerDots(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  wx: number,
  wy: number,
  corners: InnerCorners,
  liftPx = 0,
): void {
  for (const key of Object.keys(CORNER_RECT) as (keyof InnerCorners)[]) {
    if (!corners[key]) continue;
    const rect = CORNER_RECT[key];
    placeFractionalRect(scene, container, wx, wy, rect.x, rect.y, CORNER_DOT_COLOR, 1, liftPx);
  }
}
