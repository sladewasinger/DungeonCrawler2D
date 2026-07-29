import { describe, expect, it } from "vitest";
import { fireFlameConfig } from "../../particles/particleRecipes.js";
import { AREA_FIRE_FIELD } from "../presentation/areaVisualStyle.js";
import { fireFieldFlameDeficit } from "./fireFieldFlameLifecycle.js";

describe("connected fire flame lifecycle", () => {
  it("uses a reusable concurrent particle cap, not a lifetime particle cap", () => {
    const config = fireFlameConfig(1);
    expect(config.maxAliveParticles).toBe(AREA_FIRE_FIELD.maximumLiveFlames);
    expect(config.maxParticles).toBeUndefined();
  });

  it("refills every expired flame batch across multiple lifetimes", () => {
    let alive = 0;
    for (let lifetime = 0; lifetime < 4; lifetime++) {
      alive += fireFieldFlameDeficit({ alive, showCore: false });
      expect(alive).toBe(AREA_FIRE_FIELD.maximumLiveFlames);
      alive = 0;
    }
  });

  it("does not add dynamic flame particles to a single-tile core", () => {
    expect(fireFieldFlameDeficit({ alive: 0, showCore: true })).toBe(0);
  });
});
