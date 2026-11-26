/** Prop specifications for trees, foliage, boulders, crystals, and mineral veins. */
import { PropKind, type HarvestToolKind, type PropSpec } from "@dc2d/contracts";

const CAT_TREE = "tree" as const;
const CAT_FOLIAGE = "foliage" as const;
const CAT_ROCK = "rock" as const;
const CAT_ORE = "ore" as const;
const SHAPE_CIRCLE = "circle" as const;
const SHAPE_NONE = "none" as const;
const SURF_WOOD = "wood" as const;
const SURF_STONE = "stone" as const;
const SURF_NONE = "none" as const;
const TOOL_WOOD: HarvestToolKind = "wood";
const TOOL_STONE: HarvestToolKind = "stone";
const TOOL_FORAGE: HarvestToolKind = "forage";
const ITEM_WOOD = "wood";
const ITEM_STONE = "stone";
const ITEM_HERB = "herb";
const ITEM_AMBER = "amber-resin";
const STEALTH_NONE = { groundCoverBonus: 0, canopyShadeBonus: 0 } as const;
const STEALTH_CANOPY = { groundCoverBonus: 0, canopyShadeBonus: 1 } as const;
const STEALTH_COVER = { groundCoverBonus: 1, canopyShadeBonus: 0 } as const;
const TREE_OCCLUSION = { radius: 0.9, weight: 0.42 } as const;

export const FLORA_AND_ROCK_PROP_SPECS = {
  [PropKind.OakTree]: {
    kind: PropKind.OakTree, category: CAT_TREE, collision: { shape: SHAPE_CIRCLE, offsetY: -0.16 },
    blocksLineOfSight: false, foliageOcclusion: TREE_OCCLUSION, stealth: STEALTH_CANOPY,
    combatSurface: SURF_WOOD, isTreeTrunk: true, spiderWebAnchor: true,
    harvest: { kind: PropKind.OakTree, maxHp: 60, requiredTool: TOOL_WOOD, replacementKind: PropKind.Stump, regrowSec: 180, drops: [{ itemId: ITEM_WOOD, min: 3, max: 5 }] },
  },
  [PropKind.PineTree]: {
    kind: PropKind.PineTree, category: CAT_TREE, collision: { shape: SHAPE_CIRCLE, offsetY: -0.15 },
    blocksLineOfSight: false, foliageOcclusion: TREE_OCCLUSION, stealth: STEALTH_CANOPY,
    combatSurface: SURF_WOOD, isTreeTrunk: true, spiderWebAnchor: true,
    harvest: { kind: PropKind.PineTree, maxHp: 56, requiredTool: TOOL_WOOD, replacementKind: PropKind.Stump, regrowSec: 180, drops: [{ itemId: ITEM_WOOD, min: 3, max: 4 }] },
  },
  [PropKind.BirchTree]: {
    kind: PropKind.BirchTree, category: CAT_TREE, collision: { shape: SHAPE_CIRCLE, offsetY: -0.16 },
    blocksLineOfSight: false, foliageOcclusion: TREE_OCCLUSION, stealth: STEALTH_CANOPY,
    combatSurface: SURF_WOOD, isTreeTrunk: true, spiderWebAnchor: true,
    harvest: { kind: PropKind.BirchTree, maxHp: 54, requiredTool: TOOL_WOOD, replacementKind: PropKind.Stump, regrowSec: 180, drops: [{ itemId: ITEM_WOOD, min: 3, max: 4 }, { itemId: ITEM_AMBER, min: 0, max: 1 }] },
  },
  [PropKind.MapleTree]: {
    kind: PropKind.MapleTree, category: CAT_TREE, collision: { shape: SHAPE_CIRCLE, offsetY: -0.16 },
    blocksLineOfSight: false, foliageOcclusion: TREE_OCCLUSION, stealth: STEALTH_CANOPY,
    combatSurface: SURF_WOOD, isTreeTrunk: true, spiderWebAnchor: true,
    harvest: { kind: PropKind.MapleTree, maxHp: 62, requiredTool: TOOL_WOOD, replacementKind: PropKind.Stump, regrowSec: 180, drops: [{ itemId: ITEM_WOOD, min: 3, max: 5 }, { itemId: ITEM_AMBER, min: 0, max: 1 }] },
  },
  [PropKind.DeadTree]: {
    kind: PropKind.DeadTree, category: CAT_TREE, collision: { shape: SHAPE_CIRCLE, offsetY: -0.18 },
    blocksLineOfSight: false, foliageOcclusion: TREE_OCCLUSION, stealth: STEALTH_NONE,
    combatSurface: SURF_WOOD, isTreeTrunk: true, spiderWebAnchor: true,
    harvest: { kind: PropKind.DeadTree, maxHp: 40, requiredTool: TOOL_WOOD, replacementKind: PropKind.Stump, regrowSec: 200, drops: [{ itemId: ITEM_WOOD, min: 2, max: 3 }] },
  },
  [PropKind.Stump]: {
    kind: PropKind.Stump, category: CAT_TREE, collision: { shape: SHAPE_CIRCLE, offsetY: -0.22 },
    blocksLineOfSight: false, stealth: STEALTH_NONE, combatSurface: SURF_NONE, spiderWebAnchor: false,
    harvest: { kind: PropKind.Stump, maxHp: 35, requiredTool: TOOL_WOOD, replacementKind: null, regrowSec: 240, drops: [{ itemId: ITEM_WOOD, min: 1, max: 2 }] },
  },
  [PropKind.GiantMushroom]: {
    kind: PropKind.GiantMushroom, category: CAT_FOLIAGE, collision: { shape: SHAPE_CIRCLE, offsetY: -0.24 },
    blocksLineOfSight: false, foliageOcclusion: { radius: 0.78, weight: 0.36 }, stealth: STEALTH_CANOPY,
    combatSurface: SURF_NONE, spiderWebAnchor: true,
    harvest: { kind: PropKind.GiantMushroom, maxHp: 24, requiredTool: TOOL_FORAGE, replacementKind: null, regrowSec: 180, drops: [{ itemId: "bog-spore", min: 1, max: 2 }, { itemId: ITEM_HERB, min: 1, max: 1 }] },
  },
  [PropKind.BogReed]: {
    kind: PropKind.BogReed, category: CAT_FOLIAGE, collision: { shape: SHAPE_NONE, offsetY: 0 },
    blocksLineOfSight: false, foliageOcclusion: { radius: 0.68, weight: 0.3 }, stealth: STEALTH_COVER,
    combatSurface: SURF_NONE, spiderWebAnchor: false,
    harvest: { kind: PropKind.BogReed, maxHp: 14, requiredTool: TOOL_FORAGE, replacementKind: null, regrowSec: 120, drops: [{ itemId: ITEM_HERB, min: 1, max: 1 }] },
  },
  [PropKind.Bush]: {
    kind: PropKind.Bush, category: CAT_FOLIAGE, collision: { shape: SHAPE_CIRCLE, offsetY: -0.26 },
    blocksLineOfSight: false, foliageOcclusion: { radius: 0.68, weight: 0.3 }, stealth: STEALTH_COVER,
    combatSurface: SURF_NONE, spiderWebAnchor: false,
    harvest: { kind: PropKind.Bush, maxHp: 20, requiredTool: TOOL_FORAGE, replacementKind: PropKind.Bush, regrowSec: 120, drops: [{ itemId: "berry", min: 1, max: 3 }, { itemId: ITEM_WOOD, min: 0, max: 1 }] },
  },
  [PropKind.TallGrass]: {
    kind: PropKind.TallGrass, category: CAT_FOLIAGE, collision: { shape: SHAPE_NONE, offsetY: 0 },
    blocksLineOfSight: false, foliageOcclusion: { radius: 0.52, weight: 0.18 }, stealth: STEALTH_COVER,
    combatSurface: SURF_NONE, spiderWebAnchor: false,
  },
  [PropKind.Wildflower]: {
    kind: PropKind.Wildflower, category: CAT_FOLIAGE, collision: { shape: SHAPE_NONE, offsetY: 0 },
    blocksLineOfSight: false, stealth: STEALTH_NONE, combatSurface: SURF_NONE, spiderWebAnchor: false,
    harvest: { kind: PropKind.Wildflower, maxHp: 14, requiredTool: TOOL_FORAGE, replacementKind: null, regrowSec: 120, drops: [{ itemId: ITEM_HERB, min: 1, max: 2 }] },
  },
  [PropKind.Boulder]: {
    kind: PropKind.Boulder, category: CAT_ROCK, collision: { shape: SHAPE_CIRCLE, offsetY: -0.32 },
    blocksLineOfSight: true, stealth: STEALTH_NONE, combatSurface: SURF_STONE, spiderWebAnchor: true,
    harvest: { kind: PropKind.Boulder, maxHp: 64, requiredTool: TOOL_STONE, replacementKind: null, regrowSec: 300, drops: [{ itemId: ITEM_STONE, min: 3, max: 5 }, { itemId: "flint", min: 1, max: 2 }] },
  },
  [PropKind.CopperVein]: {
    kind: PropKind.CopperVein, category: CAT_ORE, collision: { shape: SHAPE_CIRCLE, offsetY: -0.32 },
    blocksLineOfSight: true, stealth: STEALTH_NONE, combatSurface: SURF_STONE, spiderWebAnchor: false,
    harvest: { kind: PropKind.CopperVein, maxHp: 75, requiredTool: TOOL_STONE, replacementKind: null, regrowSec: 360, drops: [{ itemId: "copper-ore", min: 2, max: 4 }, { itemId: ITEM_STONE, min: 1, max: 2 }] },
  },
  [PropKind.IronVein]: {
    kind: PropKind.IronVein, category: CAT_ORE, collision: { shape: SHAPE_CIRCLE, offsetY: -0.32 },
    blocksLineOfSight: true, stealth: STEALTH_NONE, combatSurface: SURF_STONE, spiderWebAnchor: false,
    harvest: { kind: PropKind.IronVein, maxHp: 90, requiredTool: TOOL_STONE, replacementKind: null, regrowSec: 420, drops: [{ itemId: "iron-ore", min: 2, max: 3 }, { itemId: ITEM_STONE, min: 1, max: 2 }] },
  },
  [PropKind.CursedCrystal]: {
    kind: PropKind.CursedCrystal, category: CAT_ORE, collision: { shape: SHAPE_CIRCLE, offsetY: -0.28 },
    blocksLineOfSight: true, stealth: STEALTH_NONE, combatSurface: SURF_STONE, spiderWebAnchor: false,
    harvest: { kind: PropKind.CursedCrystal, maxHp: 85, requiredTool: TOOL_STONE, replacementKind: null, regrowSec: 420, drops: [{ itemId: "shadow-shard", min: 1, max: 2 }, { itemId: ITEM_STONE, min: 1, max: 2 }] },
  },
} as const satisfies Partial<Record<PropKind, PropSpec>>;
