/** Pure resource node specs, tool-gated harvest damage math, and loot drop rolling. */
import type { HarvestToolKind } from "../combat/weapons/weaponMovesets.js";
import { PropKind } from "../world/types.js";

export interface HarvestDropSpec {
  readonly itemId: string;
  readonly min: number;
  readonly max: number;
}

export interface HarvestNodeSpec {
  readonly kind: PropKind;
  readonly maxHp: number;
  readonly requiredTool: HarvestToolKind;
  readonly replacementKind: PropKind | null;
  readonly regrowSec: number;
  readonly drops: readonly HarvestDropSpec[];
}

const ITEM_WOOD = "wood";
const ITEM_STONE = "stone";
const TOOL_WOOD: HarvestToolKind = "wood";
const TOOL_STONE: HarvestToolKind = "stone";
const TOOL_FORAGE: HarvestToolKind = "forage";
const ITEM_HERB = "herb";

export const HARVEST_NODE_SPECS: Partial<Record<PropKind, HarvestNodeSpec>> = {
  [PropKind.OakTree]: { kind: PropKind.OakTree, maxHp: 60, requiredTool: TOOL_WOOD, replacementKind: PropKind.Stump, regrowSec: 180, drops: [{ itemId: ITEM_WOOD, min: 3, max: 5 }] },
  [PropKind.PineTree]: { kind: PropKind.PineTree, maxHp: 56, requiredTool: TOOL_WOOD, replacementKind: PropKind.Stump, regrowSec: 180, drops: [{ itemId: ITEM_WOOD, min: 3, max: 4 }] },
  [PropKind.BirchTree]: { kind: PropKind.BirchTree, maxHp: 54, requiredTool: TOOL_WOOD, replacementKind: PropKind.Stump, regrowSec: 180, drops: [{ itemId: ITEM_WOOD, min: 3, max: 4 }, { itemId: "amber-resin", min: 0, max: 1 }] },
  [PropKind.MapleTree]: { kind: PropKind.MapleTree, maxHp: 62, requiredTool: TOOL_WOOD, replacementKind: PropKind.Stump, regrowSec: 180, drops: [{ itemId: ITEM_WOOD, min: 3, max: 5 }, { itemId: "amber-resin", min: 0, max: 1 }] },
  [PropKind.DeadTree]: { kind: PropKind.DeadTree, maxHp: 40, requiredTool: TOOL_WOOD, replacementKind: PropKind.Stump, regrowSec: 200, drops: [{ itemId: ITEM_WOOD, min: 2, max: 3 }] },
  [PropKind.Stump]: { kind: PropKind.Stump, maxHp: 35, requiredTool: TOOL_WOOD, replacementKind: null, regrowSec: 240, drops: [{ itemId: ITEM_WOOD, min: 1, max: 2 }] },
  [PropKind.Boulder]: { kind: PropKind.Boulder, maxHp: 64, requiredTool: TOOL_STONE, replacementKind: null, regrowSec: 300, drops: [{ itemId: ITEM_STONE, min: 3, max: 5 }, { itemId: "flint", min: 1, max: 2 }] },
  [PropKind.CopperVein]: { kind: PropKind.CopperVein, maxHp: 75, requiredTool: TOOL_STONE, replacementKind: null, regrowSec: 360, drops: [{ itemId: "copper-ore", min: 2, max: 4 }, { itemId: ITEM_STONE, min: 1, max: 2 }] },
  [PropKind.IronVein]: { kind: PropKind.IronVein, maxHp: 90, requiredTool: TOOL_STONE, replacementKind: null, regrowSec: 420, drops: [{ itemId: "iron-ore", min: 2, max: 3 }, { itemId: ITEM_STONE, min: 1, max: 2 }] },
  [PropKind.CursedCrystal]: { kind: PropKind.CursedCrystal, maxHp: 85, requiredTool: TOOL_STONE, replacementKind: null, regrowSec: 420, drops: [{ itemId: "shadow-shard", min: 1, max: 2 }, { itemId: ITEM_STONE, min: 1, max: 2 }] },
  [PropKind.Bush]: { kind: PropKind.Bush, maxHp: 20, requiredTool: TOOL_FORAGE, replacementKind: null, regrowSec: 120, drops: [{ itemId: "berry", min: 1, max: 3 }, { itemId: ITEM_WOOD, min: 0, max: 1 }] },
  [PropKind.Wildflower]: { kind: PropKind.Wildflower, maxHp: 14, requiredTool: TOOL_FORAGE, replacementKind: null, regrowSec: 120, drops: [{ itemId: ITEM_HERB, min: 1, max: 2 }] },
  [PropKind.GiantMushroom]: { kind: PropKind.GiantMushroom, maxHp: 24, requiredTool: TOOL_FORAGE, replacementKind: null, regrowSec: 180, drops: [{ itemId: "bog-spore", min: 1, max: 2 }, { itemId: ITEM_HERB, min: 1, max: 1 }] },
  [PropKind.BogReed]: { kind: PropKind.BogReed, maxHp: 14, requiredTool: TOOL_FORAGE, replacementKind: null, regrowSec: 120, drops: [{ itemId: ITEM_HERB, min: 1, max: 1 }] },
};

export function getHarvestNodeSpec(kind: PropKind): HarvestNodeSpec | undefined {
  return HARVEST_NODE_SPECS[kind];
}

export function computeHarvestDamage(opts: {
  readonly nodeKind: PropKind;
  readonly toolKind: HarvestToolKind;
  readonly toolPower: number;
}): number {
  const spec = HARVEST_NODE_SPECS[opts.nodeKind];
  if (!spec) return 0;
  if (spec.requiredTool === TOOL_FORAGE) return Math.max(20, opts.toolPower);
  if (opts.toolKind === spec.requiredTool) return Math.max(1, opts.toolPower);
  if (opts.nodeKind === PropKind.CopperVein || opts.nodeKind === PropKind.IronVein || opts.nodeKind === PropKind.CursedCrystal) return 0;
  return spec.requiredTool === TOOL_WOOD ? 6 : 4;
}

export function rollHarvestDrops(kind: PropKind, rand = Math.random): { readonly itemId: string; readonly count: number }[] {
  const spec = HARVEST_NODE_SPECS[kind];
  if (!spec) return [];
  const out: { readonly itemId: string; readonly count: number }[] = [];
  for (const d of spec.drops) {
    const count = d.min + Math.floor(rand() * (d.max - d.min + 1));
    if (count > 0) out.push({ itemId: d.itemId, count });
  }
  return out;
}
