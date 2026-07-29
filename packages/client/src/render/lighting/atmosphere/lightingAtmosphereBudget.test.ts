import { describe, expect, it } from "vitest";
import { lightingAtmosphereBudget } from "./lightingAtmosphereBudget.js";

describe("lightingAtmosphereBudget", () => {
  it("uses quarter-resolution darkness and two fog layers on desktop", () => {
    const budget = lightingAtmosphereBudget("desktop", false);

    expect(budget.darknessDownscale).toBe(4);
    expect(budget.fogLayerCount).toBe(2);
    expect(budget.maximumRevealCells).toBe(1024);
    expect(budget.maximumParticles).toBe(18);
  });

  it("uses eighth-resolution darkness and reduced visual caps when constrained", () => {
    const budget = lightingAtmosphereBudget("constrained", false);

    expect(budget.darknessDownscale).toBe(8);
    expect(budget.fogLayerCount).toBe(1);
    expect(budget.maximumRevealCells).toBe(768);
    expect(budget.maximumParticles).toBe(8);
  });

  it("removes moving motes and keeps one static fog layer for reduced motion", () => {
    const budget = lightingAtmosphereBudget("desktop", true);

    expect(budget.fogLayerCount).toBe(1);
    expect(budget.maximumParticles).toBe(0);
  });
});
