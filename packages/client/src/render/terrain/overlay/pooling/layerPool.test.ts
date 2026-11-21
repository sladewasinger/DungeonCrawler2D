import { describe, expect, it, vi } from "vitest";
import { TerrainOverlayLayerPool } from "./layerPool.js";

describe("TerrainOverlayLayerPool ownership", () => {
  it("does not share a depth layer between visual systems", () => {
    const graphics = () => ({
      clear: vi.fn().mockReturnThis(),
      setVisible: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    });
    const scene = { add: { graphics } } as never;
    const pool = new TerrainOverlayLayerPool(scene);

    pool.beginFrame();
    const ao = pool.acquire("ao", 10, true);
    const rim = pool.acquire("cliff-rim", 10, true);

    expect(rim).not.toBe(ao);
    expect(pool.activeKeys()).toEqual(["ao:10", "cliff-rim:10"]);
  });

  it("keeps overlay painter order stable when layers are created in reverse order", () => {
    const depths: number[] = [];
    const graphics = () => ({
      clear: vi.fn().mockReturnThis(), setVisible: vi.fn().mockReturnThis(),
      setDepth: vi.fn((depth: number) => { depths.push(depth); return graphicsObject; }),
      destroy: vi.fn(),
    });
    const graphicsObject = graphics();
    const scene = { add: { graphics: () => graphicsObject } } as never;
    const pool = new TerrainOverlayLayerPool(scene);

    pool.beginFrame();
    pool.acquire("cliff-rim", 10, true);
    pool.acquire("surface", 10, true);

    expect(depths).toEqual([10.03, 10.01]);
  });
});
