// Derives stable Phaser spritesheet keys/paths/frame geometry from @dc2d/content's
// tileCatalog — pure data shaping, no Phaser/DOM calls (those live in tilePackLoader.ts).
import { tileCatalog, type TileCatalog, type TileRef } from "@dc2d/content";

/** Root every pack sheet is copied under (see docs/ASSET_LICENSES.md). */
const PACKS_BASE_PATH = "assets/packs";

/** One sheet Phaser needs to load as a 48px-frame spritesheet. */
export interface TilePackSheetSpec {
  readonly key: string;
  readonly path: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly cols: number;
  readonly rows: number;
}

/** `tilepack:<packId>:<sheetId>` — stable across reloads; never derived from array
 * index, so catalog edits can't silently reshuffle a key a save/scene already holds. */
export function tilePackSheetKey(packId: string, sheetId: string): string {
  return `tilepack:${packId}:${sheetId}`;
}

/** Every sheet across every pack in the catalog, as a Phaser-ready load spec. */
export function tilePackSheetSpecs(catalog: TileCatalog): TilePackSheetSpec[] {
  const specs: TilePackSheetSpec[] = [];
  for (const [packId, pack] of Object.entries(catalog.packs)) {
    for (const [sheetId, sheet] of Object.entries(pack.sheets)) {
      specs.push({
        key: tilePackSheetKey(packId, sheetId),
        path: `${PACKS_BASE_PATH}/${packId}/${sheet.file}`,
        frameWidth: catalog.tilePx,
        frameHeight: catalog.tilePx,
        cols: sheet.cols,
        rows: sheet.rows,
      });
    }
  }
  return specs;
}

/** A single-tile ref's Phaser frame index within its own sheet (`row * cols + col`).
 * Only meaningful for `w === 1 && h === 1` refs — multi-tile refs (backgrounds/props)
 * aren't one Phaser frame; the renderer composites those from the sheet image directly. */
export function tilePackFrameIndex(ref: TileRef, sheetCols: number): number {
  return ref.row * sheetCols + ref.col;
}

/** The manifest this app boots with — re-exported so callers don't also need
 * `@dc2d/content` just to reach the one catalog instance. */
export const bootTileCatalog: TileCatalog = tileCatalog;
