import { describe, expect, it } from "vitest";
import enemies from "./data/enemies.json" with { type: "json" };

describe("enemy combat boxes", () => {
  it("requires every authored enemy to declare positive half-extents", () => {
    for (const enemy of enemies) {
      expect(enemy.hurtbox.halfWidth, `${enemy.id} halfWidth`).toBeGreaterThan(0);
      expect(enemy.hurtbox.halfDepth, `${enemy.id} halfDepth`).toBeGreaterThan(0);
      expect(enemy.hurtbox.height, `${enemy.id} height`).toBeGreaterThan(0);
      expect(enemy.hurtbox.bottomOffset, `${enemy.id} bottomOffset`).toBeGreaterThanOrEqual(0);
    }
  });
});
