// Headless tests for the camera-margin chunk load/unload math — no Phaser involved.
import { CHUNK_SIZE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import {
  chunkKey,
  chunkWindowKey,
  desiredChunks,
  diffChunks,
  planBakes,
  SettledChunkWindow,
} from "./streaming.js";

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

  it("bounds finite-floor streaming requests to the initialized chunk rectangle", () => {
    const chunks = desiredChunks({ x: 0, y: 0, width: CHUNK_PX + 1, height: 1 }, 1, {
      minChunkX: 0, minChunkY: 0, maxChunkX: 1, maxChunkY: 0,
    });
    expect(chunks.map(chunkKey).sort()).toEqual(["0,0", "1,0"]);
  });
});

describe("chunkWindowKey", () => {
  it("is stable during sub-chunk camera motion and changes at a streaming boundary", () => {
    const start = { x: 10, y: 20, width: 100, height: 80 };
    const withinWindow = { ...start, x: 20, y: 30 };
    const crossedBoundary = { ...start, x: CHUNK_PX + 10 };

    expect(chunkWindowKey(withinWindow, 1)).toBe(chunkWindowKey(start, 1));
    expect(chunkWindowKey(crossedBoundary, 1)).not.toBe(
      chunkWindowKey(start, 1),
    );
  });

  it("skips only an idle captured window and resets for a forced rebake", () => {
    const view = { x: 10, y: 20, width: 100, height: 80 };
    const settled = new SettledChunkWindow();

    expect(settled.canSkip({ view, builderCount: 0, queueCount: 0, marginChunks: 1 })).toBe(false);
    settled.captureIfIdle({ view, builderCount: 1, queueCount: 0, marginChunks: 1 });
    expect(settled.canSkip({ view, builderCount: 0, queueCount: 0, marginChunks: 1 })).toBe(false);
    settled.captureIfIdle({ view, builderCount: 0, queueCount: 0, marginChunks: 1 });
    expect(settled.canSkip({ view: { ...view, x: 20 }, builderCount: 0, queueCount: 0, marginChunks: 1 })).toBe(true);
    expect(settled.canSkip({ view, builderCount: 1, queueCount: 0, marginChunks: 1 })).toBe(false);
    settled.reset();
    expect(settled.canSkip({ view, builderCount: 0, queueCount: 0, marginChunks: 1 })).toBe(false);
  });

  it("tracks a constrained zero-margin window independently", () => {
    const view = { x: 10, y: 20, width: 100, height: 80 };
    const settled = new SettledChunkWindow();
    settled.captureIfIdle({ view, builderCount: 0, queueCount: 0, marginChunks: 0 });
    expect(settled.canSkip({ view, builderCount: 0, queueCount: 0, marginChunks: 0 })).toBe(true);
    expect(settled.canSkip({ view, builderCount: 0, queueCount: 0, marginChunks: 1 })).toBe(false);
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

describe("planBakes", () => {
  const keysOf = (coords: { cx: number; cy: number }[]) => new Set(coords.map(chunkKey));
  const c = (cx: number, cy: number) => ({ cx, cy });

  it("bakes margin-only chunks at the margin budget, keeping the rest queued in order", () => {
    // Hand-derived: 3 margin chunks queued, maxVisible 2 / maxMargin 1 → exactly
    // the head bakes; the other two stay, order preserved.
    const queue = [c(2, 0), c(3, 0), c(4, 0)];
    const { bake, keep } = planBakes({ queue, desiredKeys: keysOf(queue), viewKeys: new Set(), maxVisible: 2, maxMargin: 1 });
    expect(bake).toEqual([c(2, 0)]);
    expect(keep).toEqual([c(3, 0), c(4, 0)]);
  });

  it("lets visible chunks jump the queue and use the full visible budget", () => {
    // Queue head is margin, but two visible chunks sit behind it: both visible
    // bake (budget 2), margin head waits (visible spend consumed the frame).
    const queue = [c(9, 9), c(1, 0), c(1, 1)];
    const viewKeys = keysOf([c(1, 0), c(1, 1)]);
    const { bake, keep } = planBakes({ queue, desiredKeys: keysOf(queue), viewKeys, maxVisible: 2, maxMargin: 1 });
    expect(bake).toEqual([c(1, 0), c(1, 1)]);
    expect(keep).toEqual([c(9, 9)]);
  });

  it("fills leftover visible budget with one margin chunk", () => {
    // One visible + margin behind: visible bakes, then min(maxMargin, 2-1)=1 margin.
    const queue = [c(5, 5), c(1, 0)];
    const viewKeys = keysOf([c(1, 0)]);
    const { bake, keep } = planBakes({ queue, desiredKeys: keysOf(queue), viewKeys, maxVisible: 2, maxMargin: 1 });
    expect(bake).toEqual([c(1, 0), c(5, 5)]);
    expect(keep).toEqual([]);
  });

  it("drops queued chunks that are no longer desired", () => {
    const queue = [c(0, 0), c(8, 8)];
    const { bake, keep } = planBakes({ queue, desiredKeys: keysOf([c(0, 0)]), viewKeys: new Set(), maxVisible: 2, maxMargin: 1 });
    expect(bake).toEqual([c(0, 0)]);
    expect(keep).toEqual([]);
  });

  it("drains everything when both budgets are unbounded (the rotation snap)", () => {
    const queue = [c(0, 0), c(1, 0), c(2, 0), c(3, 0)];
    const { bake, keep } = planBakes({
      queue,
      desiredKeys: keysOf(queue),
      viewKeys: keysOf([c(0, 0)]),
      maxVisible: Number.POSITIVE_INFINITY,
      maxMargin: Number.POSITIVE_INFINITY,
    });
    // Visible-first ordering: the one in-view chunk leads, the rest follow in order.
    expect(bake).toEqual([c(0, 0), c(1, 0), c(2, 0), c(3, 0)]);
    expect(keep).toEqual([]);
  });
});
