import { describe, expect, it } from "vitest";
import { BODY_RADIUS } from "@dc2d/engine";
import { PLAYER_METRICS, enemyMetrics } from "./entityMetrics";

describe("entity presentation metrics", () => {
  it("keeps presentation separate from the shared physics footprint", () => {
    expect(PLAYER_METRICS.footprintRadius).toBe(BODY_RADIUS);
    expect(enemyMetrics("skeleton").width).toBeLessThan(PLAYER_METRICS.width);
    expect(enemyMetrics("slime").width).toBeLessThan(enemyMetrics("skeleton").width);
  });

  it("defines tuned metrics for every starter enemy", () => {
    for (const id of ["slime", "plant-creeper", "skeleton", "spitter"]) {
      const metrics = enemyMetrics(id);
      expect(metrics.width).toBeGreaterThan(0);
      expect(metrics.width).toBeLessThanOrEqual(48);
      expect(metrics.originY).toBeGreaterThan(0.7);
    }
  });
});

