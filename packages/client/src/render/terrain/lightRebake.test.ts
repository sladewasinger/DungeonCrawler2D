// Light-rebake targeting: which chunks a placed/expired torch needs to rebuild.
import { CHUNK_SIZE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { affectedChunkKeys, chunksInLightApron } from "./lightRebake.js";
import { LIGHT_APRON } from "./tileLight.js";

describe("chunksInLightApron", () => {
  it("targets only the containing chunk for a tile deep in its interior", () => {
    // Tile 16 sits mid-chunk (chunk (0,0) spans tiles 0..31) with plenty of margin
    // either side of its LIGHT_APRON=15 reach before crossing a chunk boundary.
    const coords = chunksInLightApron(16, 16);
    expect(coords).toEqual([{ cx: 0, cy: 0 }]);
  });

  it("targets both neighbors for a landing right at a chunk border", () => {
    // Tile 31 is the last column of chunk (0, *); its apron reaches into chunk (1, *).
    const coords = chunksInLightApron(31, 16);
    const keys = new Set(coords.map((c) => `${c.cx},${c.cy}`));
    expect(keys).toEqual(new Set(["0,0", "1,0"]));
  });

  it("targets all four quadrant neighbors at a corner", () => {
    const coords = chunksInLightApron(31, 31);
    const keys = new Set(coords.map((c) => `${c.cx},${c.cy}`));
    expect(keys).toEqual(new Set(["0,0", "1,0", "0,1", "1,1"]));
  });

  it("stays inside the chunk once the apron no longer reaches the border", () => {
    // One tile further from the border than LIGHT_APRON — no longer crosses into chunk 1.
    const farFromBorder = CHUNK_SIZE - 1 - LIGHT_APRON - 1;
    const coords = chunksInLightApron(farFromBorder, 16);
    expect(coords).toEqual([{ cx: 0, cy: 0 }]);
  });
});

describe("affectedChunkKeys", () => {
  it("coalesces two torches landing in the same frame near the same border into one rebuild set", () => {
    const keys = affectedChunkKeys([
      { wx: 31, wy: 16 },
      { wx: 30, wy: 16 },
    ]);
    // Both tiles reach the same two chunks — the union still has only two entries,
    // not four, so each affected chunk rebuilds exactly once this frame.
    expect(keys).toEqual(new Set(["0,0", "1,0"]));
  });

  it("unions disjoint landings across separate chunks", () => {
    // Both tiles sit deep in their own chunk's interior (see the "deep interior" case
    // above), so each contributes exactly one chunk to the union.
    const farTile = 6 * CHUNK_SIZE + 16;
    const keys = affectedChunkKeys([
      { wx: 16, wy: 16 },
      { wx: farTile, wy: farTile },
    ]);
    expect(keys).toEqual(new Set(["0,0", "6,6"]));
  });

  it("returns an empty set for no changed tiles", () => {
    expect(affectedChunkKeys([])).toEqual(new Set());
  });
});
