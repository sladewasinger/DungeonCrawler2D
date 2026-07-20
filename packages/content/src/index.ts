// Public facade for @dc2d/content — re-exports the six raw content JSON files as-is
// (validation and typing for those happen in the engine's content registry, not here),
// plus strings.json, validated right here since it isn't wired into that registry yet
// (docs/ASSUMPTIONS.md #102 — the book-fan lane's scope didn't cover registry.ts/parse.ts).
import statuses from "./data/statuses.json" with { type: "json" };
import rules from "./data/rules.json" with { type: "json" };
import areas from "./data/areas.json" with { type: "json" };
import items from "./data/items.json" with { type: "json" };
import enemies from "./data/enemies.json" with { type: "json" };
import recipes from "./data/recipes.json" with { type: "json" };
import strings from "./data/strings.json" with { type: "json" };
import { parseStrings, type Strings } from "./data/strings.schema.js";
import tileCatalogRaw from "./data/tileCatalog.json" with { type: "json" };
import { parseTileCatalog, type TileCatalog } from "./data/tileCatalog.schema.js";

export const statusesData: readonly unknown[] = statuses;
export const rulesData: readonly unknown[] = rules;
export const areasData: readonly unknown[] = areas;
export const itemsData: readonly unknown[] = items;
export const enemiesData: readonly unknown[] = enemies;
export const recipesData: readonly unknown[] = recipes;
/** The Dungeon's premise/tagline copy, book-fan-voice — title screen (Epic 7.13). */
export const stringsData: Strings = parseStrings(strings);
/** The 7-pack tile catalog for the explicit-heights reskin (asset-foundry lane) — see
 * docs/ASSET_LICENSES.md and this file's own schema doc comments for the query shape. */
export const tileCatalog: TileCatalog = parseTileCatalog(tileCatalogRaw);
export {
  tileCatalogSchema,
  tileRefSchema,
  stairRefSchema,
  waterRefSchema,
  validateTileCatalogRefs,
  type TileRef,
  type StairRef,
  type WaterRef,
  type TilePack,
  type TileCatalog,
} from "./data/tileCatalog.schema.js";
