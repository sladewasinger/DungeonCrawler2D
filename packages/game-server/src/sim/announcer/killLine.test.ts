import type { EnemyDef } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { killVerbPhrase } from "./killLine.js";

/** Unit tests for the epithet -> active-voice killer-line transform (panel round 2 BOOKFAN). */

function def(overrides: Partial<EnemyDef>): EnemyDef {
  return {
    id: "x", name: "X", tags: [], hp: 1, speed: 1, aggroRadius: 1,
    attack: { damage: 1, range: 1, cooldown: 1 }, drops: [], sprite: "x",
    ...overrides,
  };
}

describe("killVerbPhrase", () => {
  it("flips a passive '<verb> by <clause>' epithet into an active-voice phrase", () => {
    const slime = def({ name: "Slime", epithet: "dissolved by a slime. A slime." });
    expect(killVerbPhrase(slime)).toBe("Dissolved a slime. A slime");
  });

  it("flips epithets without an internal trailing period the same way", () => {
    const creeper = def({ name: "Plant Creeper", epithet: "mulched by a houseplant with opinions" });
    expect(killVerbPhrase(creeper)).toBe("Mulched a houseplant with opinions");
  });

  it("falls back to a generic species opener when the epithet has no 'by' clause", () => {
    const spitter = def({ name: "Spitter", epithet: "spat on from a safe, professional distance" });
    expect(killVerbPhrase(spitter)).toBe(
      "Defeated a spitter. Spat on from a safe, professional distance",
    );
  });

  it("falls back to a generic species opener when the def has no epithet at all", () => {
    const mystery = def({ name: "Mystery Foe", epithet: undefined });
    expect(killVerbPhrase(mystery)).toBe("Defeated a mystery foe");
  });
});
