import { CHUNK_SIZE } from "@dc2d/engine";
import atlas from "./atlas.json";

/** Shared screen-space scale: world tiles → pixels. */
export const TILE_PX = atlas.tileSize;
export const CHUNK_PX = CHUNK_SIZE * TILE_PX;
/** Vertical exaggeration: one height unit lifts a sprite this many px.
 * Applies to ALL elevation (grounded included, eased) — the world is
 * viewed at a slight angle, so standing higher draws you a bit further
 * up-screen and walking downstairs visibly descends. Kept subtle: a
 * +2 platform shifts ¾ of a tile. */
export const Z_PX = 24;
