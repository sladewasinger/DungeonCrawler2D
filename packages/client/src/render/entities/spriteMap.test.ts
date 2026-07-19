// Headless tests for player-skin hashing and the content-driven monster sprite lookup.
import { describe, expect, it } from "vitest";
import { monsterSpriteFor, playerSkinFor } from "./spriteMap.js";

describe("playerSkinFor", () => {
  it("is deterministic for the same id", () => {
    expect(playerSkinFor("player-42")).toBe(playerSkinFor("player-42"));
  });

  it("spreads across more than one skin for a range of ids", () => {
    const skins = new Set(Array.from({ length: 20 }, (_, i) => playerSkinFor(`p${i}`)));
    expect(skins.size).toBeGreaterThan(1);
  });
});

describe("monsterSpriteFor", () => {
  it("resolves the v2 atlas names ported from enemies.json", () => {
    expect(monsterSpriteFor("skeleton")).toBe("skelet");
    expect(monsterSpriteFor("spitter")).toBe("imp");
    expect(monsterSpriteFor("slime")).toBe("slime");
    expect(monsterSpriteFor("plant-creeper")).toBe("plant_creeper");
  });

  it("falls back for an unknown or missing defId", () => {
    expect(monsterSpriteFor("no-such-enemy")).toBe("skelet");
    expect(monsterSpriteFor(undefined)).toBe("skelet");
  });
});
