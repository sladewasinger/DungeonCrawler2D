import { describe, expect, it } from "vitest";
import { hashString } from "../../core/rng.js";
import { CHUNK_SIZE } from "../types.js";
import { biomeAtWorldTile } from "./biome.js";
import { SUPERCHUNK_SIZE } from "./district.js";

describe("world biomes", () => {
  it("is deterministic and stable throughout a district", () => {
    const seed = hashString("biome-world");
    const first = biomeAtWorldTile(seed, 3, 0, 0);
    const districtSpan = SUPERCHUNK_SIZE * CHUNK_SIZE;
    for (let y = 0; y < districtSpan; y += 11) {
      for (let x = 0; x < districtSpan; x += 13) {
        expect(biomeAtWorldTile(seed, 3, x, y)).toEqual(first);
      }
    }
    expect(biomeAtWorldTile(seed, 3, 0, 0)).toEqual(first);
  });

  it("varies across deterministic district groups", () => {
    const seed = hashString("biome-variety");
    const seen = new Set<string>();
    for (let cy = -18; cy <= 18; cy += SUPERCHUNK_SIZE) {
      for (let cx = -18; cx <= 18; cx += SUPERCHUNK_SIZE) {
        seen.add(biomeAtWorldTile(seed, 1, cx * CHUNK_SIZE, cy * CHUNK_SIZE).biome);
      }
    }
    expect(seen.size).toBe(6);
  });
});
