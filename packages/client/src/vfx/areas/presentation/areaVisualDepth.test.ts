import { describe, expect, it } from "vitest";
import { depthForEntity } from "../../../render/entities/presentation/depthSort.js";
import { areaVisualDepthsForRow } from "./areaVisualDepth.js";
import {
  AREA_EMISSION_FREQUENCIES,
  AREA_EMISSION_LIFETIMES,
  AREA_VISUAL_BUDGETS,
} from "./areaVisualStyle.js";

describe("area visual depth band", () => {
  it("orders terrain, liquids, actors, the fire core, and particle clouds", () => {
    const row = 34;
    const depths = areaVisualDepthsForRow(row);
    const body = depthForEntity(row + 0.5);

    expect(depths.terrain).toBeLessThan(depths.liquid);
    expect(depths.liquid).toBeLessThan(body);
    expect(body).toBeLessThan(depths.fireCore);
    expect(depths.fireCore).toBeLessThan(depths.cloud);
  });

  it("keeps a cloud below the next screen row so terrain/entity occlusion remains local", () => {
    const row = 34;
    expect(areaVisualDepthsForRow(row).cloud).toBeLessThan(depthForEntity(row + 1));
  });

  it("keeps every fire emission alive longer than its next emission interval", () => {
    const { fire: frequency } = AREA_EMISSION_FREQUENCIES;
    const { fire: lifespan } = AREA_EMISSION_LIFETIMES;
    const scale = AREA_VISUAL_BUDGETS.reduced.emissionFrequencyScale;
    expect(lifespan.flame).toBeGreaterThan(frequency.flame * scale);
    expect(lifespan.ember).toBeGreaterThan(frequency.ember * scale);
    expect(lifespan.spark).toBeGreaterThan(frequency.spark * scale);
  });
});
