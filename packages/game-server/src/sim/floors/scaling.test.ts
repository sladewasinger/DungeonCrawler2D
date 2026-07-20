import type { EnemyDef } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { floorStatMultiplier, scaledEnemyDef } from "./scaling.js";

/** Unit tests for the per-floor enemy stat scaling table (Epic 7.14). */

const SLIME: EnemyDef = {
  id: "slime",
  name: "Slime",
  tags: ["organic"],
  hp: 12,
  speed: 3,
  aggroRadius: 8,
  attack: { damage: 2, range: 0.9, cooldown: 1.2 },
  drops: [],
  sprite: "slime",
  xp: 5,
};

describe("floors/scaling", () => {
  it("floor 1 multiplier is exactly 1.0 — zero behavior change there", () => {
    expect(floorStatMultiplier(1)).toBe(1);
  });

  it("compounds 35% per floor past 1", () => {
    expect(floorStatMultiplier(2)).toBeCloseTo(1.35);
    expect(floorStatMultiplier(3)).toBeCloseTo(1.35 * 1.35);
    expect(floorStatMultiplier(5)).toBeCloseTo(1.35 ** 4);
  });

  it("scaledEnemyDef returns the SAME reference on floor 1 (no allocation, no drift)", () => {
    expect(scaledEnemyDef(SLIME, 1)).toBe(SLIME);
  });

  it("scales hp, attack.damage, and xp on deeper floors without touching speed/tags/sprite", () => {
    const scaled = scaledEnemyDef(SLIME, 3);
    const mult = floorStatMultiplier(3);
    expect(scaled.hp).toBeCloseTo(SLIME.hp * mult);
    expect(scaled.attack.damage).toBeCloseTo(SLIME.attack.damage * mult);
    expect(scaled.xp).toBe(Math.round(SLIME.xp! * mult));
    expect(scaled.speed).toBe(SLIME.speed);
    expect(scaled.tags).toBe(SLIME.tags);
    expect(scaled.sprite).toBe(SLIME.sprite);
  });

  it("never mutates the shared content def object (every floor reads the same base)", () => {
    scaledEnemyDef(SLIME, 4);
    expect(SLIME.hp).toBe(12);
    expect(SLIME.attack.damage).toBe(2);
  });
});
