// Bench content wiring (Epic 7.11): builds the same validated ContentRegistry the game
// server runs against, once, and exposes the brush catalogs the paint panel's EFFECTS/
// SPAWN sections and the SIMULATE loop both read from — never a second hardcoded copy.
import { areasData, enemiesData, itemsData, recipesData, rulesData, statusesData } from "@dc2d/content";
import { buildContentRegistry, type ContentRegistry, type EnemyDef } from "@dc2d/engine";

let cached: ContentRegistry | undefined;

/** Lazily builds (once) and returns the pure content registry — same validator, same data. */
export function benchContent(): ContentRegistry {
  if (!cached) {
    cached = buildContentRegistry({
      statuses: statusesData as unknown[],
      rules: rulesData as unknown[],
      areas: areasData as unknown[],
      items: itemsData as unknown[],
      enemies: enemiesData as unknown[],
      recipes: recipesData as unknown[],
    });
  }
  return cached;
}

export interface AreaBrushDef {
  readonly areaId: string;
  readonly label: string;
}

/** EFFECTS.md's launch area set, minus the two areas with no dedicated brush (steam and
 * smoke both arise from meetings/decay — steam gets a brush per the roadmap's bullet list;
 * smoke stays a spread-only byproduct, no paintable source in the live game either). */
export const AREA_BRUSHES: readonly AreaBrushDef[] = [
  { areaId: "area-fire", label: "fire" },
  { areaId: "area-poison", label: "poison" },
  { areaId: "area-oil", label: "oil" },
  { areaId: "area-wet", label: "wet" },
  { areaId: "area-steam", label: "steam" },
];

/** The 4 starter enemies (Epic 7.11 bullet), in content-file order. */
export const ENEMY_BRUSH_IDS: readonly string[] = ["slime", "plant-creeper", "skeleton", "spitter"];

/** Assumption #58 (docs/ASSUMPTIONS.md): raw-meat stands in as the one ground-item stamp —
 * organic/food tags exercise both fire char-adjacent visuals and the poison-on-eat status. */
export const GROUND_ITEM_BRUSH_ID = "raw-meat";

export function enemyDef(defId: string): EnemyDef | undefined {
  return benchContent().enemies.get(defId);
}
