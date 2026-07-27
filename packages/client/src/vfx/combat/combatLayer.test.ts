import { describe, expect, it } from "vitest";
import {
  COMBAT_PARTICLE_DEPTH,
  COMBAT_TEXT_DEPTH,
} from "./combatLayer.js";

describe("combat VFX display layers", () => {
  it("keeps airborne burst feedback above additive light halos", () => {
    const lightHaloDepth = 400_000;
    expect(COMBAT_PARTICLE_DEPTH).toBeGreaterThan(lightHaloDepth);
    expect(COMBAT_TEXT_DEPTH).toBeGreaterThan(COMBAT_PARTICLE_DEPTH);
  });
});
