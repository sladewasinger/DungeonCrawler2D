import { BIOME, type BiomeKind } from "../layout/district.js";

export const TERRITORY_IDS = {
  GoblinPowderworks: "goblin-powderworks", SilkboundBroodcourt: "silkbound-broodcourt",
  BoneTitheOssuary: "bone-tithe-ossuary", ChainwardenGaol: "chainwarden-gaol",
  MyconidBellows: "myconid-bellows", KoboldCountermine: "kobold-countermine",
  CultistStarChapel: "cultist-star-chapel", RatkinTannery: "ratkin-tannery",
  AshDwarfSmeltery: "ash-dwarf-smeltery", WraithMirrorWard: "wraith-mirror-ward",
  MimicTreasury: "mimic-treasury", ClockworkReliquary: "clockwork-reliquary",
  ThornboundCourt: "thornbound-court", CarrionAviary: "carrion-aviary",
  AlchemistContainmentWard: "alchemist-containment-ward", OrcDrillBastion: "orc-drill-bastion",
  SaltboundInquisition: "saltbound-inquisition", CandleMonkScriptorium: "candle-monk-scriptorium",
  CrystalResonatorGuild: "crystal-resonator-guild", GraveMasonYard: "grave-mason-yard",
} as const;
export type TerritoryId = (typeof TERRITORY_IDS)[keyof typeof TERRITORY_IDS];

export type TerritoryLayoutSignature =
  "workshop-clusters" | "radial-brood-chambers" | "processional-alcoves" | "cell-block-guard-loops" |
  "pressure-chambers" | "switchback-countermines" | "ritual-rings" | "work-court-slaloms" |
  "production-spine" | "mirrored-chambers" | "nested-vaults" | "mechanical-hubs" |
  "spiral-duel-courts" | "roost-funnels" | "containment-rings" | "formation-courts" |
  "tribunal-naves" | "reading-galleries" | "resonator-network" | "mason-work-yards";

export interface TerritoryProfile {
  readonly id: TerritoryId;
  readonly name: string;
  readonly visualIdentity: string;
  readonly materialBiome: BiomeKind;
  readonly materialIndex: number;
  readonly layoutSignature: TerritoryLayoutSignature;
  readonly ownershipTags: readonly string[];
  readonly roomScale: number;
  readonly roomStride: number;
  readonly roomChance: number;
  readonly straightChance: number;
}

export const DEFAULT_TERRITORY_ROSTER: readonly TerritoryId[] = Object.freeze([
  TERRITORY_IDS.GoblinPowderworks, TERRITORY_IDS.SilkboundBroodcourt,
  TERRITORY_IDS.ChainwardenGaol, TERRITORY_IDS.CultistStarChapel,
]);

const TERRITORY_CATALOG: readonly TerritoryProfile[] = [
  profile(TERRITORY_IDS.GoblinPowderworks, "Goblin Powderworks", "scrap workshops, sulfur lamps, and soot-black blast bays", BIOME.Maze, 0, "workshop-clusters", ["goblin", "sapper"], [0.8, 24, 0.9, 0.72]),
  profile(TERRITORY_IDS.SilkboundBroodcourt, "Silkbound Broodcourt", "web curtains, cocoon stacks, and chitin-dark nests", BIOME.Pools, 1, "radial-brood-chambers", ["spider", "brood"], [1.25, 36, 0.7, 0.42]),
  profile(TERRITORY_IDS.BoneTitheOssuary, "Bone-Tithe Ossuary", "ivory arches, tally shrines, and tribute cords", BIOME.Ruins, 2, "processional-alcoves", ["undead", "bone-cult"], [0.75, 28, 0.82, 0.82]),
  profile(TERRITORY_IDS.ChainwardenGaol, "Chainwarden Gaol", "iron bars, numbered cells, and guard lanterns", BIOME.Ruins, 2, "cell-block-guard-loops", ["jailer", "guard"], [0.7, 24, 0.94, 0.88]),
  profile(TERRITORY_IDS.MyconidBellows, "Myconid Bellows", "breathing caps, spore pipes, and membrane walls", BIOME.Pools, 1, "pressure-chambers", ["myconid", "spore"], [1.35, 40, 0.62, 0.4]),
  profile(TERRITORY_IDS.KoboldCountermine, "Kobold Countermine", "timber braces, survey chalk, and unstable seams", BIOME.Maze, 0, "switchback-countermines", ["kobold", "trapper"], [0.65, 24, 0.84, 0.3]),
  profile(TERRITORY_IDS.CultistStarChapel, "Cultist Star Chapel", "obsidian altars, brass constellations, and violet candles", BIOME.OpenHalls, 3, "ritual-rings", ["cultist", "astral"], [1.5, 40, 0.7, 0.9]),
  profile(TERRITORY_IDS.RatkinTannery, "Ratkin Tannery", "hide racks, smoke pots, and copper hooks", BIOME.Maze, 0, "work-court-slaloms", ["ratkin", "skinner"], [0.9, 28, 0.86, 0.62]),
  profile(TERRITORY_IDS.AshDwarfSmeltery, "Ash-Dwarf Smeltery", "basalt furnaces, slag seams, and iron molds", BIOME.OpenHalls, 3, "production-spine", ["ash-dwarf", "construct"], [1.2, 36, 0.68, 0.92]),
  profile(TERRITORY_IDS.WraithMirrorWard, "Wraith Mirror Ward", "silver mirrors, blue flames, and doubled arches", BIOME.Pillars, 4, "mirrored-chambers", ["wraith", "haunt"], [1.0, 32, 0.76, 0.78]),
  profile(TERRITORY_IDS.MimicTreasury, "Mimic Treasury", "gilded doors, strongboxes, and velvet ropes", BIOME.Arena, 5, "nested-vaults", ["mimic", "treasure-guard"], [0.9, 28, 0.84, 0.7]),
  profile(TERRITORY_IDS.ClockworkReliquary, "Clockwork Reliquary", "brass gears, glass reliquaries, and pendulums", BIOME.Pillars, 4, "mechanical-hubs", ["construct", "clockwork"], [1.1, 32, 0.74, 0.76]),
  profile(TERRITORY_IDS.ThornboundCourt, "Thornbound Court", "black vines, pale blossoms, and antlered statues", BIOME.Pools, 1, "spiral-duel-courts", ["thorn-fey", "beast"], [1.3, 40, 0.66, 0.52]),
  profile(TERRITORY_IDS.CarrionAviary, "Carrion Aviary", "bone perches, feather drifts, and feeding bells", BIOME.OpenHalls, 3, "roost-funnels", ["carrion", "harpy"], [1.4, 40, 0.64, 0.84]),
  profile(TERRITORY_IDS.AlchemistContainmentWard, "Alchemist Containment Ward", "reagent glass, chalk circles, and scorched benches", BIOME.Pools, 1, "containment-rings", ["alchemist", "ooze"], [1.0, 32, 0.78, 0.72]),
  profile(TERRITORY_IDS.OrcDrillBastion, "Orc Drill Bastion", "hide banners, weapon racks, and stone barricades", BIOME.Arena, 5, "formation-courts", ["orc", "warband"], [1.35, 36, 0.72, 0.86]),
  profile(TERRITORY_IDS.SaltboundInquisition, "Saltbound Inquisition", "white mineral walls, wax seals, and confession chairs", BIOME.Ruins, 2, "tribunal-naves", ["inquisitor", "zealot"], [1.15, 36, 0.72, 0.88]),
  profile(TERRITORY_IDS.CandleMonkScriptorium, "Candle-Monk Scriptorium", "wax-covered desks, vellum, and brass lecterns", BIOME.Ruins, 2, "reading-galleries", ["candle-monk", "scribe"], [0.9, 28, 0.9, 0.94]),
  profile(TERRITORY_IDS.CrystalResonatorGuild, "Crystal Resonator Guild", "crystal forks, copper coils, and geometric plinths", BIOME.Pillars, 4, "resonator-network", ["crystal-construct", "guild-guard"], [1.1, 32, 0.76, 0.8]),
  profile(TERRITORY_IDS.GraveMasonYard, "Grave-Mason Yard", "unfinished sarcophagi, crane hooks, and numbered stone", BIOME.Maze, 0, "mason-work-yards", ["grave-mason", "undead"], [1.0, 28, 0.84, 0.74]),
];

export function territoryProfile(id: TerritoryId): TerritoryProfile {
  const found = TERRITORY_CATALOG.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Unknown finite-dungeon territory: ${id}`);
  return found;
}

export function isTerritoryId(value: string): value is TerritoryId {
  return TERRITORY_CATALOG.some(({ id }) => id === value);
}

type ProfileArguments = readonly [TerritoryId, string, string, BiomeKind, number, TerritoryLayoutSignature, readonly string[], readonly [number, number, number, number]];

function profile(...[id, name, visualIdentity, materialBiome, materialIndex, layoutSignature, ownershipTags, geometry]: ProfileArguments): TerritoryProfile {
  const [roomScale, roomStride, roomChance, straightChance] = geometry;
  return {
    id, name,
    visualIdentity,
    materialBiome, materialIndex, layoutSignature, ownershipTags, roomScale, roomStride, roomChance, straightChance,
  };
}
