import type { World } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { ChunkLightStream, type ChunkLightScannerLike } from "./chunkLightStream.js";

function scanner(): ChunkLightScannerLike & { readonly scanned: string[] } {
  const scanned: string[] = [];
  return {
    scanned,
    scan: ({ cx, cy }) => {
      scanned.push(`${cx},${cy}`);
      return [];
    },
  };
}

function world(): World {
  return { tileRevision: 0 } as unknown as World;
}

describe("ChunkLightStream", () => {
  it("stages initial authored-light scans across updates", () => {
    const lightScanner = scanner();
    const stream = new ChunkLightStream(world(), {
      loadMarginChunks: 0,
      scanBudget: 2,
      scanner: lightScanner,
    });
    const view = { x: 0, y: 0, width: 4096, height: 4096 };

    stream.stream(view);
    expect(lightScanner.scanned).toHaveLength(2);
    expect(stream.pendingScanCount()).toBeGreaterThan(0);

    stream.stream(view);
    expect(lightScanner.scanned).toHaveLength(4);
  });

  it("drops pending scans outside a changed window", () => {
    const lightScanner = scanner();
    const stream = new ChunkLightStream(world(), {
      loadMarginChunks: 0,
      scanBudget: 1,
      scanner: lightScanner,
    });

    stream.stream({ x: 0, y: 0, width: 4096, height: 4096 });
    const pendingBeforeMove = stream.pendingScanCount();
    stream.stream({ x: 8192, y: 8192, width: 1536, height: 1536 });

    expect(pendingBeforeMove).toBeGreaterThan(0);
    expect(stream.pendingScanCount()).toBeLessThanOrEqual(pendingBeforeMove);
    expect(lightScanner.scanned).toHaveLength(2);
  });

  it("clears queued and loaded scans on invalidation", () => {
    const lightScanner = scanner();
    const stream = new ChunkLightStream(world(), {
      loadMarginChunks: 0,
      scanBudget: 1,
      scanner: lightScanner,
    });

    stream.stream({ x: 0, y: 0, width: 4096, height: 4096 });
    stream.invalidate();

    expect(stream.pendingScanCount()).toBe(0);
    expect([...stream.values()]).toHaveLength(0);
  });
});
