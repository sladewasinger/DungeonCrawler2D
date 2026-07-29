import { FEATURE_FACE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { planTerrain, TERRAIN_KINDS } from "../terrainPlanner.js";

describe("terrain prop planning", () => {
  it("renders sprite-backed furniture over an intact floor cap", () => {
    const plan = planTerrain({
      voidTerrain: true,
      terrainAt: () => TERRAIN_KINDS.Floor,
      heightAt: () => 0,
      propAt: () => "stash",
    }, { bounds: { x: 0, y: 0, width: 1, height: 1 }, orientation: 0 });

    expect(plan.batches.floors).toHaveLength(1);
    expect(plan.batches.floors[0]).toMatchObject({ kind: "floor", height: 0 });
    expect(plan.batches.props).toHaveLength(1);
    expect(plan.batches.props[0]).toMatchObject({ kind: "prop", prop: "stash" });
  });

  it("preserves an arena gate's authored orientation over its floor", () => {
    const plan = planTerrain({
      voidTerrain: false,
      terrainAt: () => TERRAIN_KINDS.Floor,
      heightAt: () => 0,
      featureFaceAt: () => FEATURE_FACE.East,
      propAt: () => "arena-gate",
    }, { bounds: { x: 0, y: 0, width: 1, height: 1 }, orientation: 0 });

    expect(plan.batches.floors).toHaveLength(1);
    expect(plan.batches.props[0]).toMatchObject({
      prop: "arena-gate",
      featureFace: FEATURE_FACE.East,
    });
  });
});
