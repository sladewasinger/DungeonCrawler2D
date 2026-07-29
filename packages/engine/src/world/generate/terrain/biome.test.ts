import { describe, expect, it } from "vitest";
import { hashString } from "../../../core/rng.js";
import { CHUNK_SIZE } from "../../core/types.js";
import { biomeAtWorldTile } from "./biome.js";
import { DISTRICT_CHUNK_SPAN } from "../layout/district.js";

describe("world biomes", () => {
  it("is deterministic and stable throughout a district", () => {
    const seed = hashString("biome-world");
    const first = biomeAtWorldTile({ worldSeed: seed, floor: 3, wx: 0, wy: 0 });
    const districtSpan = DISTRICT_CHUNK_SPAN * CHUNK_SIZE;
    for (let y = 0; y < districtSpan; y += 11) {
      for (let x = 0; x < districtSpan; x += 13) {
        expect(biomeAtWorldTile({ worldSeed: seed, floor: 3, wx: x, wy: y })).toEqual(first);
      }
    }
    expect(biomeAtWorldTile({ worldSeed: seed, floor: 3, wx: 0, wy: 0 })).toEqual(first);
  });

  it("varies across deterministic district groups", () => {
    const seed = hashString("biome-variety");
    const seen = new Set<string>();
    for (let cy = -18; cy <= 18; cy += DISTRICT_CHUNK_SPAN) {
      for (let cx = -18; cx <= 18; cx += DISTRICT_CHUNK_SPAN) {
        seen.add(biomeAtWorldTile({ worldSeed: seed, floor: 1, wx: cx * CHUNK_SIZE, wy: cy * CHUNK_SIZE }).biome);
      }
    }
    expect(seen.size).toBe(6);
  });
});
