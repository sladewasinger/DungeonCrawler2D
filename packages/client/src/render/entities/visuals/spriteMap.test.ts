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

  it("uses an explicitly selected skin for local and remote players", () => {
    expect(playerSkinFor("player-42", "dwarf_f")).toBe("dwarf_f");
  });
});

describe("monsterSpriteFor", () => {
  it("resolves the v2 atlas names ported from enemies.json", () => {
    expect(monsterSpriteFor("skeleton")).toBe("skelet");
    expect(monsterSpriteFor("spitter")).toBe("imp");
    expect(monsterSpriteFor("slime")).toBe("slime");
    expect(monsterSpriteFor("plant-creeper")).toBe("plant_creeper");
    expect(monsterSpriteFor("pitchbloom")).toBe("pitchbloom");
  });

  it("maps every expanded Dungeon Tileset II monster family", () => {
    expect([
      "goblin", "masked-orc", "orc-warrior", "orc-shaman", "orc-warlord",
      "tiny-zombie", "big-zombie", "chort", "big-demon", "wogol",
      "pumpkin-fiend", "fallen-angel",
    ].map(monsterSpriteFor)).toEqual([
      "goblin", "masked_orc", "orc_warrior", "orc_shaman", "ogre",
      "tiny_zombie", "big_zombie", "chort", "big_demon", "wogol",
      "pumpkin_dude", "angel",
    ]);
  });

  it("falls back for an unknown or missing defId", () => {
    expect(monsterSpriteFor("no-such-enemy")).toBe("skelet");
    expect(monsterSpriteFor(undefined)).toBe("skelet");
  });
});
