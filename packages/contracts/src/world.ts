/** Core shared world spatial constants, runtime enum values, biome, and POI contracts. */

export const CHUNK_SIZE = 32;
export const TILE_PX = 16;

export const GroundKind = {
  DeepWater: 0,
  ShallowWater: 1,
  Sand: 2,
  Grass: 3,
  MeadowGrass: 4,
  ForestFloor: 5,
  DirtPath: 6,
  CliffStone: 7,
  MossStone: 8,
  AutumnGrass: 9,
  AutumnFloor: 10,
  BogMud: 11,
  BogMoss: 12,
  SlateRock: 13,
  AshGround: 14,
  RuinFlagstone: 15,
  CursedMoss: 16,
} as const;

export type GroundKind = (typeof GroundKind)[keyof typeof GroundKind];

export const GROUND_KIND_VALUES = [
  GroundKind.DeepWater,
  GroundKind.ShallowWater,
  GroundKind.Sand,
  GroundKind.Grass,
  GroundKind.MeadowGrass,
  GroundKind.ForestFloor,
  GroundKind.DirtPath,
  GroundKind.CliffStone,
  GroundKind.MossStone,
  GroundKind.AutumnGrass,
  GroundKind.AutumnFloor,
  GroundKind.BogMud,
  GroundKind.BogMoss,
  GroundKind.SlateRock,
  GroundKind.AshGround,
  GroundKind.RuinFlagstone,
  GroundKind.CursedMoss,
] as const;

export const PropKind = {
  OakTree: "oak-tree",
  PineTree: "pine-tree",
  BirchTree: "birch-tree",
  MapleTree: "maple-tree",
  DeadTree: "dead-tree",
  GiantMushroom: "giant-mushroom",
  BogReed: "bog-reed",
  CursedCrystal: "cursed-crystal",
  Bush: "bush",
  TallGrass: "tall-grass",
  Boulder: "boulder",
  Wildflower: "wildflower",
  Campfire: "campfire",
  Torch: "torch",
  Stump: "stump",
  Palisade: "palisade",
  Tent: "tent",
  RuinPillar: "ruin-pillar",
  CopperVein: "copper-vein",
  IronVein: "iron-vein",
  Workbench: "workbench",
  Bed: "bed",
  WoodChest: "wood-chest",
  ShrineAltar: "shrine-altar",
  Waystone: "waystone",
  Gravestone: "gravestone",
  BrokenCart: "broken-cart",
  GreatStump: "great-stump",
  SunkenBoat: "sunken-boat",
  LoreSign: "lore-sign",
  BoneTotem: "bone-totem",
  RunicForge: "runic-forge",
  CursedObelisk: "cursed-obelisk",
  BrazierUnlit: "brazier-unlit",
  BrazierLit: "brazier-lit",
  HermitHut: "hermit-hut",
  FairyRing: "fairy-ring",
  StashChest: "stash-chest",
  BountyBoard: "bounty-board",
  NpcGuide: "npc-guide",
  NpcMerchant: "npc-merchant",
  NpcBlacksmith: "npc-blacksmith",
} as const;

export type PropKind = (typeof PropKind)[keyof typeof PropKind];

export const PROP_KIND_VALUES = [
  PropKind.OakTree,
  PropKind.PineTree,
  PropKind.BirchTree,
  PropKind.MapleTree,
  PropKind.DeadTree,
  PropKind.GiantMushroom,
  PropKind.BogReed,
  PropKind.CursedCrystal,
  PropKind.Bush,
  PropKind.TallGrass,
  PropKind.Boulder,
  PropKind.Wildflower,
  PropKind.Campfire,
  PropKind.Torch,
  PropKind.Stump,
  PropKind.Palisade,
  PropKind.Tent,
  PropKind.RuinPillar,
  PropKind.CopperVein,
  PropKind.IronVein,
  PropKind.Workbench,
  PropKind.Bed,
  PropKind.WoodChest,
  PropKind.ShrineAltar,
  PropKind.Waystone,
  PropKind.Gravestone,
  PropKind.BrokenCart,
  PropKind.GreatStump,
  PropKind.SunkenBoat,
  PropKind.LoreSign,
  PropKind.BoneTotem,
  PropKind.RunicForge,
  PropKind.CursedObelisk,
  PropKind.BrazierUnlit,
  PropKind.BrazierLit,
  PropKind.HermitHut,
  PropKind.FairyRing,
  PropKind.StashChest,
  PropKind.BountyBoard,
  PropKind.NpcGuide,
  PropKind.NpcMerchant,
  PropKind.NpcBlacksmith,
] as const;

export const NPC_KINDS = ["guide", "merchant", "blacksmith", "bounty-board"] as const;
export type NpcKind = (typeof NPC_KINDS)[number];

export type BiomeKind =
  | "verdant-forest"
  | "autumn-woods"
  | "misty-bog"
  | "craggy-highlands"
  | "cursed-ruinlands";

export type DangerTier = 1 | 2 | 3 | 4 | 5;
export type PoiCategory = "camp" | "ruins" | "shrine" | "micro" | "lair" | "puzzle" | "friendly";

export type PoiKind =
  | "bandit-camp"
  | "ancient-ruins"
  | "shrine-swiftness"
  | "shrine-vigor"
  | "shrine-shadow"
  | "ancient-waystone"
  | "fallen-knight-grave"
  | "overturned-cart"
  | "fairy-ring"
  | "hollow-great-stump"
  | "sunken-rowboat"
  | "hunters-blind"
  | "broodmother-hollow"
  | "orc-totem-ring"
  | "golem-forge"
  | "cursed-obelisk"
  | "brazier-vault"
  | "sun-dial-ruin"
  | "hermits-hut"
  | "tinker-camp"
  | "safe-room";

export type PoiLayoutKind =
  | "camp-outpost"
  | "camp-l-shape"
  | "camp-courtyard"
  | "camp-warband"
  | "ruins-shrine"
  | "ruins-colonnade"
  | "ruins-sanctum"
  | Exclude<PoiKind, "bandit-camp" | "ancient-ruins">;
