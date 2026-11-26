/** Pure resource node specs, tool-gated harvest damage math, and loot drop rolling. */
import { PROP_SPECS } from "@dc2d/content";
import {
  PropKind,
  type HarvestDropSpec, type HarvestNodeSpec, type HarvestToolKind,
} from "@dc2d/contracts";

export type { HarvestDropSpec, HarvestNodeSpec };

const TOOL_FORAGE: HarvestToolKind = "forage";
const TOOL_WOOD: HarvestToolKind = "wood";

function buildHarvestNodeSpecs(): Partial<Record<PropKind, HarvestNodeSpec>> {
  const out: Partial<Record<PropKind, HarvestNodeSpec>> = {};
  for (const spec of Object.values(PROP_SPECS)) {
    if (spec.harvest) out[spec.kind] = spec.harvest;
  }
  return out;
}

export const HARVEST_NODE_SPECS: Partial<Record<PropKind, HarvestNodeSpec>> = buildHarvestNodeSpecs();

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
