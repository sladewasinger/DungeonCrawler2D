import { describe, expect, it } from "vitest";
import { craftRecipeInState } from "../inventory/crafting.js";
import { createEmptyInventoryState } from "../inventory/slotModel.js";
import { WorldChunkCache } from "../world/collision.js";
import { GroundKind, PropKind } from "../world/types.js";
import { PALISADE_MAX_HP, canPlaceStructure, validateStructurePlacement } from "./campBuilding.js";
import { computeHarvestDamage, rollHarvestDrops } from "./harvestRules.js";
import { applyWellFedDuration, computeSurvivalRegen } from "./survivalBuffs.js";
import { WorldDeltaOverlay } from "./worldDeltas.js";

class FlatCampCache extends WorldChunkCache {
  override tileAt(wx: number) {
    return { ground: Math.floor(wx) === 15 ? GroundKind.DeepWater : GroundKind.Grass, elevation: 0, stairs: false };
  }
}

describe("Phase 8 engine survival rules and chunk deltas", () => {
  it("[REQ-P8-05] computes tool-gated harvest damage and ore requirements", () => {
    expect(computeHarvestDamage({ nodeKind: PropKind.OakTree, toolKind: "wood", toolPower: 28 })).toBe(28);
    expect(computeHarvestDamage({ nodeKind: PropKind.OakTree, toolKind: "none", toolPower: 0 })).toBe(6);
    expect(computeHarvestDamage({ nodeKind: PropKind.IronVein, toolKind: "wood", toolPower: 28 })).toBe(0);
    expect(computeHarvestDamage({ nodeKind: PropKind.IronVein, toolKind: "stone", toolPower: 28 })).toBe(28);
    expect(computeHarvestDamage({ nodeKind: PropKind.Bush, toolKind: "none", toolPower: 0 })).toBe(20);
    expect(rollHarvestDrops(PropKind.Bush, () => 0.5).some((d) => d.itemId === "berry")).toBe(true);
  });

  it("validates camp building terrain/range and composes chunk deltas with revision bumps", () => {
    const cache = new FlatCampCache(1337);
    expect(canPlaceStructure({ cache, x: 4, y: 0, playerX: 2.5, playerY: 0, playerElev: 0, kind: "campfire" })).toBe(false);
    expect(canPlaceStructure({ cache, x: 14, y: 0, playerX: 12.5, playerY: 0, playerElev: 0, kind: "campfire" })).toBe(true);
    expect(canPlaceStructure({ cache, x: 15.5, y: 0, playerX: 14, playerY: 0, playerElev: 0, kind: "campfire" })).toBe(false);
    expect(canPlaceStructure({ cache, x: 12.5, y: 0, playerX: 12.5, playerY: 0, playerElev: 0, kind: "bed" })).toBe(false);

    const rev0 = cache.chunkRevision(0, 0);
    cache.addPlacedStructure({ id: "str-1", kind: "campfire", itemId: "camp-campfire", x: 4.5, y: 1.5, elevation: 0, ownerName: "Hero" });
    expect(cache.chunkRevision(0, 0)).toBeGreaterThan(rev0);
    const chunk = cache.getChunk(0, 0);
    expect(chunk.props.some((p) => p.id === "str-1" && p.kind === PropKind.Campfire)).toBe(true);
    expect(chunk.lights.some((l) => l.id === "light:str-1")).toBe(true);

    const oak = chunk.props.find((p) => p.kind === PropKind.OakTree);
    if (oak) {
      cache.setDepletedProp({ propId: oak.id, replacementKind: PropKind.Stump, regrowAtSec: 200 });
      expect(cache.getChunk(0, 0).props.find((p) => p.id === oak.id)?.kind).toBe(PropKind.Stump);
      cache.restoreProp(oak.id);
      expect(cache.getChunk(0, 0).props.find((p) => p.id === oak.id)?.kind).toBe(PropKind.OakTree);
    }
  });

  it("computes Well-Fed and Rested buff regeneration only outside active hit stun", () => {
    const active = computeSurvivalRegen({ wellFedTimer: 30, restedTimer: 60, hitTimer: 0 });
    expect(active.hpPerSec).toBeCloseTo(2.2, 3);
    expect(active.staminaBonusPerSec).toBe(18);
    const hurt = computeSurvivalRegen({ wellFedTimer: 30, restedTimer: 60, hitTimer: 0.2 });
    expect(hurt.hpPerSec).toBe(0);
    expect(hurt.staminaBonusPerSec).toBe(18);
  });

  it("replaces BrazierUnlit props and bumps chunk revision when litBraziers delta arrives", () => {
    const cache = new FlatCampCache(1337);
    const overlay = new WorldDeltaOverlay();
    const brazierId = "brazier:brazier-vault:4,-2:0";
    const dirty = overlay.replaceFromSnapshot({ depleted: [], structures: [], litBraziers: [brazierId] });
    expect(dirty).toContain("4,-2");
    expect(overlay.chunkRevision(4, -2)).toBeGreaterThan(0);

    const revBefore = cache.chunkRevision(4, -2);
    cache.applyWorldDeltaSnapshot({ depleted: [], structures: [], litBraziers: [brazierId] });
    expect(cache.chunkRevision(4, -2)).toBeGreaterThan(revBefore);

    const chunk = cache.getChunk(4, -2);
    const withUnlit = {
      ...chunk,
      props: [
        ...chunk.props,
        { id: brazierId, kind: PropKind.BrazierUnlit, x: 64.5, y: -32.5, variant: 0, elevation: 0, radius: 0.36, blocksMovement: true },
      ],
    };
    const updated = overlay.applyChunkDeltas(withUnlit);
    expect(updated.props.find((p) => p.id === brazierId)?.kind).toBe(PropKind.BrazierLit);
    expect(updated.lights.some((l) => l.id === `${brazierId}-light`)).toBe(true);
  });

  it("[REQ-P8-09][REQ-P8-12][REQ-P8-15] validates placement reasons, palisade maxHp, and buff separation", () => {
    const poiCache = new (class extends FlatCampCache {
      override poisNear() {
        return [{ id: "poi-shrine", kind: "ancient-waystone" as const, layout: "ancient-waystone" as const, cx: 0, cy: 0, centerX: 40, centerY: 40, radiusX: 5, radiusY: 5, elevation: 0, chestX: 40, chestY: 40, isSanctuary: true }];
      }
    })(1337);
    expect(canPlaceStructure({ cache: poiCache, x: 40, y: 40, playerX: 39, playerY: 40, playerElev: 0, kind: "palisade" })).toBe(false);
    expect(canPlaceStructure({ cache: poiCache, x: 45, y: 40, playerX: 46, playerY: 40, playerElev: 0, kind: "palisade" })).toBe(false);

    const inv = createEmptyInventoryState();
    inv.slots[0] = { itemId: "sword", count: 2, prefixId: "keen" };
    const wbRecipe = {
      id: "test-wb", outputItemId: "copper-sword", outputCount: 1,
      requiresWorkbench: true, ingredients: [{ itemId: "sword", count: 1 }],
    };
    expect(craftRecipeInState(inv, { recipe: wbRecipe, nearCampfire: true, nearWorkbench: false, maxStackFor: () => 5 })).toBeNull();
    const crafted = craftRecipeInState(inv, { recipe: wbRecipe, nearCampfire: false, nearWorkbench: true, maxStackFor: () => 5 });
    expect(crafted?.slots[0]).toEqual({ itemId: "sword", count: 1, prefixId: "keen" });

    expect(PALISADE_MAX_HP).toBe(80);
    expect(validateStructurePlacement({ cache: poiCache, x: 12.6, y: 0, playerX: 12.5, playerY: 0, playerElev: 0, kind: "bed" })).toEqual({ ok: false, reason: "Too Close" });
    expect(validateStructurePlacement({ cache: poiCache, x: 20, y: 0, playerX: 12.5, playerY: 0, playerElev: 0, kind: "bed" })).toEqual({ ok: false, reason: "Too Far" });
    expect(validateStructurePlacement({ cache: poiCache, x: 15.5, y: 0, playerX: 14, playerY: 0, playerElev: 0, kind: "bed" })).toEqual({ ok: false, reason: "Water" });
    expect(applyWellFedDuration(240, 45)).toBe(240);
    const fullBuff = computeSurvivalRegen({ wellFedTimer: 10, restedTimer: 0, invigoratedTimer: 30, hotTimer: 2, hitTimer: 1 });
    expect(fullBuff.maxHpBonus).toBe(15);
    expect(fullBuff.staminaBonusPerSec).toBe(24);
    expect(fullBuff.hpPerSec).toBeCloseTo(13.75, 2);
  });
});
