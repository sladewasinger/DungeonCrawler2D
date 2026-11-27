/** Overworld biome metadata: display names, danger tiers, wildlife rosters, and particle themes. */
import type { BiomeKind, DangerTier, WildlifeKind } from "@dc2d/contracts";

export type ContentBiomeId = BiomeKind;
export type ContentDangerTier = DangerTier;
export type AmbientParticleTheme = "sunmotes" | "leaves" | "spores" | "embers" | "wisps";

export interface BiomeCatalogEntry {
  readonly id: BiomeKind;
  readonly displayName: string;
  readonly subtitle: string;
  readonly accentHex: string;
  readonly baseDangerTier: DangerTier;
  readonly particleTheme: AmbientParticleTheme;
  readonly wildlifeRoster: readonly WildlifeKind[];
}

export const BIOME_CATALOG: Readonly<Record<ContentBiomeId, BiomeCatalogEntry>> = {
  "verdant-forest": {
    id: "verdant-forest",
    displayName: "Verdant Forest",
    subtitle: "Sheltered Timberlands",
    accentHex: "#6daa4b",
    baseDangerTier: 1,
    particleTheme: "sunmotes",
    wildlifeRoster: ["wolf", "boar", "bear"],
  },
  "autumn-woods": {
    id: "autumn-woods",
    displayName: "Autumn Woods",
    subtitle: "Amber Canopy & Raider Trails",
    accentHex: "#e09b3d",
    baseDangerTier: 2,
    particleTheme: "leaves",
    wildlifeRoster: ["wolf", "boar", "bear", "goblin"],
  },
  "misty-bog": {
    id: "misty-bog",
    displayName: "Misty Bog",
    subtitle: "Spore-Shrouded Marshes",
    accentHex: "#2dd4bf",
    baseDangerTier: 2,
    particleTheme: "spores",
    wildlifeRoster: ["slime", "spider", "boar"],
  },
  "craggy-highlands": {
    id: "craggy-highlands",
    displayName: "Craggy Highlands",
    subtitle: "Sunstone Ridges & Warbands",
    accentHex: "#f59e0b",
    baseDangerTier: 3,
    particleTheme: "embers",
    wildlifeRoster: ["orc", "golem", "bear", "wolf"],
  },
  "cursed-ruinlands": {
    id: "cursed-ruinlands",
    displayName: "Cursed Ruinlands",
    subtitle: "Forsaken Obelisks & Shadow",
    accentHex: "#a855f7",
    baseDangerTier: 4,
    particleTheme: "wisps",
    wildlifeRoster: ["skeleton", "golem", "spider", "orc"],
  },
};

export function getBiomeEntry(biome: ContentBiomeId): BiomeCatalogEntry {
  return BIOME_CATALOG[biome];
}
