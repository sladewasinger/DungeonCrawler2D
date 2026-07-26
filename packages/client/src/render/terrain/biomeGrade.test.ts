import { CHUNK_SIZE, SUPERCHUNK_SIZE, TILE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { terrainBiomeGrade } from "./tileLight.js";

const world = {
  worldSeed: 228182761,
  floor: 1,
  tileAt: () => TILE.Floor,
  heightAt: () => 0,
};

describe("terrain biome grade", () => {
  it("is stable inside a district and varies between district groups", () => {
    const districtSpan = CHUNK_SIZE * SUPERCHUNK_SIZE;
    const origin = terrainBiomeGrade(world, 0, 0);
    expect(terrainBiomeGrade(world, districtSpan - 1, districtSpan - 1)).toBe(origin);

    const seen = new Set<number>();
    for (let y = -3; y <= 3; y++) {
      for (let x = -3; x <= 3; x++) {
        seen.add(terrainBiomeGrade(world, x * districtSpan, y * districtSpan));
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });

  it("leaves editor terrain neutral when no deterministic world identity exists", () => {
    expect(terrainBiomeGrade({
      tileAt: () => TILE.Floor,
      heightAt: () => 0,
    }, 12, -4)).toBe(0xffffff);
  });
});
