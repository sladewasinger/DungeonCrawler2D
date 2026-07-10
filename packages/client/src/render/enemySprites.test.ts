import { describe, expect, it } from "vitest";
import { ENEMY_ANIMATION_STATES, enemyAssetPath, enemyFrameCount, enemyTextureKey } from "./enemySprites";

describe("enemy sprite states", () => {
  it("loads distinct state-specific assets for every starter enemy", () => {
    for (const enemy of ["slime", "plant-creeper", "skeleton", "spitter"]) {
      for (const state of ENEMY_ANIMATION_STATES) {
        expect(enemyFrameCount(enemy, state)).toBeGreaterThan(0);
        expect(enemyAssetPath(enemy, state, 0)).toContain(`/${state}-0.png`);
        expect(enemyTextureKey(enemy, state, 0)).toContain(`-${state}-0`);
      }
    }
  });
});
