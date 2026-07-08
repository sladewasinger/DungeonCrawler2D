import { CHUNK_SIZE } from "@dc2d/engine";
import atlas from "./atlas.json";

/** Shared screen-space scale: world tiles → pixels. */
export const TILE_PX = atlas.tileSize;
export const CHUNK_PX = CHUNK_SIZE * TILE_PX;
/** Vertical exaggeration: one height unit lifts a sprite this many px. */
export const Z_PX = 48;
