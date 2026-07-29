import { describe, expect, it } from "vitest";
import { hashString } from "../../core/rng.js";
import { TERRAIN, TILE } from "../core/types.js";
import { generateChunk } from "../generate.js";

describe("dev-world VOID chunk contract", () => {
  it("keeps every generated cell aligned across tile, terrain, and height planes", () => {
    const chunk = generateChunk({ worldSeed: hashString("dev-world-1"), floor: 1, cx: 1, cy: -1 });
    for (let index = 0; index < chunk.tiles.length; index += 1) {
      const isVoid = chunk.terrain[index] === TERRAIN.Void;
      expect(chunk.tiles[index] === TILE.Void).toBe(isVoid);
      expect(chunk.terrain[index]).toBe(isVoid ? TERRAIN.Void : TERRAIN.Floor);
      if (isVoid) expect(chunk.height[index]).toBe(0);
    }
  });
});
