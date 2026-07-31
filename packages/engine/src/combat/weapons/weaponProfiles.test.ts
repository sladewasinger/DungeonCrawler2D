import { describe, expect, it } from "vitest";
import {
  attackProfileInputSchema,
  resolveWeaponProfile,
} from "./weaponProfiles.js";

describe("attack profiles", () => {
  it("resolves the legacy sword contract without changing its behavior", () => {
    const profile = resolveWeaponProfile({
      weapon: { damage: 9, range: 2, cooldownMs: 350, arcCos: 0.7071, knockbackForce: 10 },
    });
    expect(profile).toMatchObject({
      damage: 9,
      range: 2,
      cooldownMs: 350,
      arcCos: 0.7071,
      shape: "cone",
      knockbackForce: 10,
    });
  });

  it("keeps authored hammer attacks ground-centered with strong knockback", () => {
    const profile = resolveWeaponProfile({
      weapon: { damage: 7, range: 1.7, cooldownMs: 500, shape: "ground", knockbackForce: 18 },
    });
    expect(profile.shape).toBe("ground");
    expect(profile.knockbackForce).toBe(18);
    expect(profile.damage).toBeLessThan(9);
  });

  it("rejects an incomplete authored profile at the content boundary", () => {
    expect(attackProfileInputSchema.safeParse({ damage: 0 }).success).toBe(false);
    expect(attackProfileInputSchema.safeParse({ damage: 7, shape: "beam" }).success).toBe(false);
  });
});
