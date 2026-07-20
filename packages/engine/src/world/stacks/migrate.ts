// Editor-map JSON loader: validates raw JSON against whichever version's zod
// schema matches, migrating v1 {tiles,heights[,torches]} saves (including
// both docs/examples fixtures) up to v2 stacks. A v1 save has no "version"
// key at all — its presence (and only its presence) is the version tag.

import { heightFieldToStacks } from "./fromHeightField.js";
import { editorMapV1Schema, editorMapV2Schema } from "./schema.js";
import type { EditorMapV1, EditorMapV2 } from "./types.js";

/** Square-grid dimension inference: both today's editor saves (EDITOR_GRID_SIZE=20,
 * 400-length arrays) are square, and no v1 save ever carried its own width/rows —
 * callers that know a non-square source grid pass it explicitly. */
function inferSquareWidth(length: number): number {
  return Math.round(Math.sqrt(length));
}

/** Migrate one v1 map to v2, converting its flat tiles/heights pair to stacks via the same mechanical reverse-mapping worldgen's output layer uses. */
export function migrateMapV1(data: EditorMapV1, width = inferSquareWidth(data.tiles.length)): EditorMapV2 {
  const rows = Math.round(data.tiles.length / width);
  const tiles = Uint8Array.from(data.tiles);
  const height = Float32Array.from(data.heights);
  const stacks = heightFieldToStacks(tiles, height, width, rows);
  return { version: 2, width, rows, stacks, torches: data.torches };
}

/** Parse untrusted JSON as either version and return v2, migrating v1 on the way. */
export function loadEditorMap(json: unknown): EditorMapV2 {
  const v2 = editorMapV2Schema.safeParse(json);
  if (v2.success) return v2.data;
  return migrateMapV1(editorMapV1Schema.parse(json));
}
