// Zod schema for tileCatalog.json — the machine-readable index of the 7 RPG-Maker-MV-format
// tile packs in assets/packs/ (Epic "explicit heights reskin" pivot, asset-foundry lane).
// This is the contract the renderer/editor lanes paint from: every entry names a sheet +
// 48px cell rect, never a code special case.
import { z } from "zod";

/** One rectangular region on a sheet, in TILE units (not pixels), 0-indexed from the
 * sheet's top-left cell — frame index for a Phaser spritesheet is `row * sheet.cols + col`
 * for a 1x1 ref; multi-tile refs (w/h > 1) are backgrounds/props placed at (col,row) and
 * are NOT single Phaser frames — the renderer composites them from the sheet image directly. */
export const tileRefSchema = z.object({
  sheet: z.string(),
  col: z.number().int().min(0),
  row: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
  label: z.string(),
});
export type TileRef = z.infer<typeof tileRefSchema>;

/** A stair piece: `functional: false` marks decorative risers/dais-steps that are NOT a
 * paintable single-tile climb (ornamental set-pieces, small altar steps) — only
 * `functional: true` entries are candidates for the engine's TILE.Stairs grammar. */
export const stairRefSchema = tileRefSchema.extend({
  climbDirection: z.enum(["north", "south", "east", "west"]),
  functional: z.boolean(),
});
export type StairRef = z.infer<typeof stairRefSchema>;

/** `animated: true` is noted but not yet wired — every water/lava-flow piece here is the
 * static frame; per-pack animation is explicitly deferred (asset-foundry lane scope). */
export const waterRefSchema = tileRefSchema.extend({
  animated: z.boolean(),
});
export type WaterRef = z.infer<typeof waterRefSchema>;

export const sheetMetaSchema = z.object({
  file: z.string(),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
});
export type SheetMeta = z.infer<typeof sheetMetaSchema>;

export const tilePackSchema = z.object({
  displayName: z.string(),
  sheets: z.record(z.string(), sheetMetaSchema),
  floorVariants: z.array(tileRefSchema),
  /** Wall-top autotile pieces. Empty for every pack in this wave — see docs/ASSUMPTIONS.md
   * row on the two _A4 sheets' unpainted top-autotile template rows. */
  wallTop: z.array(tileRefSchema),
  wallFace: z.array(tileRefSchema),
  stairs: z.array(stairRefSchema),
  doors: z.array(tileRefSchema),
  torches: z.array(tileRefSchema),
  props: z.array(tileRefSchema),
  hazards: z.array(tileRefSchema),
  water: z.array(waterRefSchema),
  notes: z.array(z.string()),
});
export type TilePack = z.infer<typeof tilePackSchema>;

export const tileCatalogSchema = z.object({
  version: z.literal(1),
  tilePx: z.literal(48),
  packs: z.record(z.string(), tilePackSchema),
});
export type TileCatalog = z.infer<typeof tileCatalogSchema>;

export function parseTileCatalog(raw: unknown): TileCatalog {
  return tileCatalogSchema.parse(raw);
}

function categoriesOf(pack: TilePack): Record<string, readonly TileRef[]> {
  return {
    floorVariants: pack.floorVariants,
    wallTop: pack.wallTop,
    wallFace: pack.wallFace,
    stairs: pack.stairs,
    doors: pack.doors,
    torches: pack.torches,
    props: pack.props,
    hazards: pack.hazards,
    water: pack.water,
  };
}

/**
 * Cross-reference check zod alone can't express: every ref's `sheet` must name a sheet
 * the pack declares, and its (col,row,w,h) rect must fit inside that sheet's (cols,rows).
 * Returns an empty array when the catalog is internally consistent.
 */
export function validateTileCatalogRefs(catalog: TileCatalog): string[] {
  const errors: string[] = [];
  for (const [packId, pack] of Object.entries(catalog.packs)) {
    for (const [category, refs] of Object.entries(categoriesOf(pack))) {
      for (const ref of refs) {
        const sheet = pack.sheets[ref.sheet];
        const where = `${packId}.${category}[${ref.label}]`;
        if (!sheet) {
          errors.push(`${where}: unknown sheet "${ref.sheet}"`);
          continue;
        }
        if (ref.col + ref.w > sheet.cols || ref.row + ref.h > sheet.rows) {
          errors.push(`${where}: rect (${ref.col},${ref.row},${ref.w}x${ref.h}) exceeds sheet "${ref.sheet}" (${sheet.cols}x${sheet.rows})`);
        }
      }
    }
  }
  return errors;
}
