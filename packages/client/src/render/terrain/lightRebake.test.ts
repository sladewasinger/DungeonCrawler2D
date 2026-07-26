// Light-rebake targeting: which chunks a placed/expired torch needs to rebuild.
import { CHUNK_SIZE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { affectedChunkKeys, chunksInLightApron } from "./lightRebake.js";
import { LIGHT_APRON } from "./tileLight.js";

describe("chunksInLightApron", () => {
  it("targets only the containing chunk for a tile deep in its interior", () => {
    const middle = Math.floor(CHUNK_SIZE / 2);
    const coords = chunksInLightApron(middle, middle);
    expect(coords).toEqual([{ cx: 0, cy: 0 }]);
  });

  it("targets both neighbors for a landing right at a chunk border", () => {
    const coords = chunksInLightApron(CHUNK_SIZE - 1, Math.floor(CHUNK_SIZE / 2));
    const keys = new Set(coords.map((c) => `${c.cx},${c.cy}`));
    expect(keys).toEqual(new Set(["0,0", "1,0"]));
  });

  it("targets all four quadrant neighbors at a corner", () => {
    const coords = chunksInLightApron(CHUNK_SIZE - 1, CHUNK_SIZE - 1);
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
      { wx: CHUNK_SIZE - 1, wy: Math.floor(CHUNK_SIZE / 2) },
      { wx: CHUNK_SIZE - 2, wy: Math.floor(CHUNK_SIZE / 2) },
    ]);
    // Both tiles reach the same two chunks — the union still has only two entries,
    // not four, so each affected chunk rebuilds exactly once this frame.
    expect(keys).toEqual(new Set(["0,0", "1,0"]));
  });

  it("unions disjoint landings across separate chunks", () => {
    // Both tiles sit deep in their own chunk's interior (see the "deep interior" case
    // above), so each contributes exactly one chunk to the union.
    const middle = Math.floor(CHUNK_SIZE / 2);
    const farTile = 6 * CHUNK_SIZE + middle;
    const keys = affectedChunkKeys([
      { wx: middle, wy: middle },
      { wx: farTile, wy: farTile },
    ]);
    expect(keys).toEqual(new Set(["0,0", "6,6"]));
  });

  it("returns an empty set for no changed tiles", () => {
    expect(affectedChunkKeys([])).toEqual(new Set());
  });
});
