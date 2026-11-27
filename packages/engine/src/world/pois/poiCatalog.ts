/** Complete catalog of all 20 biome POI types with biome weights, categories, and discovery metadata. */
import { hashUnit2d } from "../../math/noise.js";
import type { BiomeKind, DangerTier, PoiCategory, PoiKind } from "../types.js";

export interface PoiCatalogEntry {
  readonly kind: PoiKind;
  readonly displayName: string;
  readonly flavor: string;
  readonly category: PoiCategory;
  readonly biomes: readonly BiomeKind[];
  readonly weight: number;
  readonly hasChest: boolean;
  readonly minTier?: DangerTier | undefined;
  readonly isSanctuary?: boolean | undefined;
  readonly shrineKind?: "swiftness" | "vigor" | "shadow" | "waystone" | undefined;
  readonly eliteKind?: "spider" | "orc" | "golem" | "skeleton" | undefined;
  readonly eliteTitle?: string | undefined;
  readonly loreText?: string | undefined;
}

const B_VERDANT: BiomeKind = "verdant-forest";
const B_AUTUMN: BiomeKind = "autumn-woods";
const B_BOG: BiomeKind = "misty-bog";
const B_HIGHLANDS: BiomeKind = "craggy-highlands";
const B_CURSED: BiomeKind = "cursed-ruinlands";

const ALL_BIOMES: readonly BiomeKind[] = [B_VERDANT, B_AUTUMN, B_BOG, B_HIGHLANDS, B_CURSED];
const MILD_BIOMES: readonly BiomeKind[] = [B_VERDANT, B_AUTUMN, B_HIGHLANDS];

export const POI_CATALOG: Readonly<Record<PoiKind, PoiCatalogEntry>> = {
  "bandit-camp": { kind: "bandit-camp", displayName: "Raider Encampment", flavor: "Palisaded goblin & orc outpost", category: "camp", biomes: MILD_BIOMES, weight: 1.4, hasChest: true },
  "ancient-ruins": { kind: "ancient-ruins", displayName: "Ancient Ruins", flavor: "Sunken colonnade guarded by stone & bone", category: "ruins", biomes: ALL_BIOMES, weight: 1.2, hasChest: true },
  "shrine-swiftness": { kind: "shrine-swiftness", displayName: "Wind Shrine", flavor: "Swiftness & endurance blessing", category: "shrine", biomes: ALL_BIOMES, weight: 0.9, hasChest: false, shrineKind: "swiftness" },
  "shrine-vigor": { kind: "shrine-vigor", displayName: "Vigor Wellspring", flavor: "Restores vitality & fortifies max HP", category: "shrine", biomes: MILD_BIOMES, weight: 0.85, hasChest: false, shrineKind: "vigor" },
  "shrine-shadow": { kind: "shrine-shadow", displayName: "Shadow Altar", flavor: "Veils footsteps & sharpens backstabs", category: "shrine", biomes: [B_BOG, B_CURSED], weight: 0.95, hasChest: false, minTier: 2, shrineKind: "shadow" },
  "ancient-waystone": { kind: "ancient-waystone", displayName: "Ancient Waystone", flavor: "Reveals nearby undiscovered landmarks", category: "shrine", biomes: ALL_BIOMES, weight: 1.0, hasChest: false, shrineKind: "waystone" },
  "fallen-knight-grave": { kind: "fallen-knight-grave", displayName: "Fallen Knight's Grave", flavor: "A rusted blade watches over old armor", category: "micro", biomes: MILD_BIOMES, weight: 1.1, hasChest: true },
  "overturned-cart": { kind: "overturned-cart", displayName: "Overturned Merchant Cart", flavor: "Spilled cargo claimed by scavengers", category: "micro", biomes: [B_VERDANT, B_AUTUMN], weight: 1.15, hasChest: true },
  "fairy-ring": { kind: "fairy-ring", displayName: "Fairy Ring", flavor: "Luminous mushroom circle with hidden spoils", category: "micro", biomes: [B_VERDANT, B_BOG], weight: 1.05, hasChest: true },
  "hollow-great-stump": { kind: "hollow-great-stump", displayName: "Hollow Great Stump", flavor: "Ancient bark den concealing a secret stash", category: "micro", biomes: [B_VERDANT, B_AUTUMN], weight: 1.05, hasChest: true },
  "sunken-rowboat": { kind: "sunken-rowboat", displayName: "Sunken Rowboat", flavor: "Beached skiff rotting in bog reeds", category: "micro", biomes: [B_BOG], weight: 1.3, hasChest: true },
  "hunters-blind": { kind: "hunters-blind", displayName: "Hunter's Blind", flavor: "Tucked overlook left by frontier scouts", category: "micro", biomes: [B_VERDANT, B_AUTUMN], weight: 1.05, hasChest: true, loreText: "Scout's Log: Elk trails turn fierce past the bog. Pack a torch for the old brazier vaults." },
  "broodmother-hollow": { kind: "broodmother-hollow", displayName: "Broodmother Hollow", flavor: "Web-draped lair of the Broodmother", category: "lair", biomes: [B_BOG, B_VERDANT], weight: 0.75, hasChest: true, minTier: 2, eliteKind: "spider", eliteTitle: "Broodmother" },
  "orc-totem-ring": { kind: "orc-totem-ring", displayName: "Orc Totem Ring", flavor: "War drums & bone totems of a Warchief", category: "lair", biomes: [B_HIGHLANDS, B_AUTUMN], weight: 0.75, hasChest: true, minTier: 2, eliteKind: "orc", eliteTitle: "Orc Warchief" },
  "golem-forge": { kind: "golem-forge", displayName: "Ancient Golem Forge", flavor: "Glowing anvil tended by a Runic Golem", category: "lair", biomes: [B_HIGHLANDS, B_CURSED], weight: 0.75, hasChest: true, minTier: 3, eliteKind: "golem", eliteTitle: "Runic Golem" },
  "cursed-obelisk": { kind: "cursed-obelisk", displayName: "Cursed Obelisk", flavor: "Violet monolith bound by a Cursed Warden", category: "lair", biomes: [B_CURSED], weight: 0.9, hasChest: true, minTier: 4, eliteKind: "skeleton", eliteTitle: "Cursed Warden" },
  "brazier-vault": { kind: "brazier-vault", displayName: "Sealed Brazier Vault", flavor: "Light all 3 braziers with fire to unseal", category: "puzzle", biomes: [B_VERDANT, B_HIGHLANDS, B_CURSED], weight: 0.8, hasChest: true, minTier: 3 },
  "sun-dial-ruin": { kind: "sun-dial-ruin", displayName: "Sundial Sanctum", flavor: "Ignite twin sun-braziers to claim its relic", category: "puzzle", biomes: MILD_BIOMES, weight: 0.8, hasChest: true, minTier: 2 },
  "hermits-hut": { kind: "hermits-hut", displayName: "Hermit's Sanctuary", flavor: "Safe refuge hearth & herbalist bench", category: "friendly", biomes: [B_VERDANT, B_AUTUMN, B_BOG], weight: 0.85, hasChest: true, isSanctuary: true, loreText: "Hermit's Note: Rest beside my fire, traveler. Ancient cores forge blades that burn the dark." },
  "tinker-camp": { kind: "tinker-camp", displayName: "Tinker's Roadside Camp", flavor: "Friendly wayside workbench & supplies", category: "friendly", biomes: ALL_BIOMES, weight: 0.85, hasChest: true, isSanctuary: true, loreText: "Tinker's Journal: Tap any item slot to inspect stats & prefixes before smelting new ingots!" },
};

export const POI_CATALOG_LIST: readonly PoiCatalogEntry[] = Object.values(POI_CATALOG);
export const TOTAL_POI_TYPES = POI_CATALOG_LIST.length;

export function getPoiCatalogEntry(kind: PoiKind): PoiCatalogEntry {
  return POI_CATALOG[kind];
}

function isEligiblePoi(entry: PoiCatalogEntry, biome: BiomeKind, tier: DangerTier): boolean {
  return entry.biomes.includes(biome) && (entry.minTier ?? 1) <= tier;
}

export function pickBiomeWeightedPoiKind(opts: {
  readonly worldSeed: number; readonly cx: number; readonly cy: number; readonly biome: BiomeKind; readonly dangerTier?: DangerTier;
}): PoiKind {
  const tier = opts.dangerTier ?? 1;
  const candidates = POI_CATALOG_LIST.filter((e) => isEligiblePoi(e, opts.biome, tier));
  const pool = candidates.length > 0 ? candidates : POI_CATALOG_LIST.filter((e) => (e.minTier ?? 1) <= tier);
  const total = pool.reduce((sum, e) => sum + e.weight, 0);
  let r = hashUnit2d(opts.worldSeed + 613, opts.cx, opts.cy) * total;
  for (const entry of pool) {
    if (r < entry.weight) return entry.kind;
    r -= entry.weight;
  }
  return pool[0]?.kind ?? "bandit-camp";
}
