// Headless tests for the camera-margin chunk load/unload math — no Phaser involved.
import { CHUNK_SIZE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { chunkKey, desiredChunks, diffChunks } from "./streaming.js";

const CHUNK_PX = CHUNK_SIZE * SCREEN_TILE_PX;

describe("desiredChunks", () => {
  it("returns just the origin chunk for a view inside it with no margin", () => {
    const chunks = desiredChunks({ x: 0, y: 0, width: 10, height: 10 }, 0);
    expect(chunks).toEqual([{ cx: 0, cy: 0 }]);
  });

  it("expands by marginChunks on every side", () => {
    const chunks = desiredChunks({ x: 0, y: 0, width: 10, height: 10 }, 1);
    const keys = chunks.map(chunkKey).sort();
    expect(keys).toEqual(
      [-1, 0, 1].flatMap((cy) => [-1, 0, 1].map((cx) => `${cx},${cy}`)).sort(),
    );
  });

  it("covers a view spanning multiple chunks", () => {
    const chunks = desiredChunks({ x: 0, y: 0, width: CHUNK_PX + 1, height: 1 }, 0);
    expect(chunks.map(chunkKey).sort()).toEqual(["0,0", "1,0"]);
  });
});

describe("diffChunks", () => {
  it("loads everything desired when nothing is loaded yet", () => {
    const desired = [{ cx: 0, cy: 0 }, { cx: 1, cy: 0 }];
    const { toLoad, toUnloadKeys } = diffChunks(desired, new Set());
    expect(toLoad).toEqual(desired);
    expect(toUnloadKeys).toEqual([]);
  });

  it("unloads chunks that fell outside the desired set", () => {
    const loaded = new Set(["0,0", "5,5"]);
    const { toLoad, toUnloadKeys } = diffChunks([{ cx: 0, cy: 0 }], loaded);
    expect(toLoad).toEqual([]);
    expect(toUnloadKeys).toEqual(["5,5"]);
  });

  it("leaves still-desired, already-loaded chunks alone", () => {
    const loaded = new Set(["0,0"]);
    const { toLoad, toUnloadKeys } = diffChunks([{ cx: 0, cy: 0 }], loaded);
    expect(toLoad).toEqual([]);
    expect(toUnloadKeys).toEqual([]);
  });
});
