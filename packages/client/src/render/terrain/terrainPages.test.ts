import { describe, expect, it } from "vitest";
import { pagePoolFor, terrainPageMemoryFor } from "./terrainPages.js";

describe("terrain page recycling", () => {
  it("allocates native-resolution base pages with nearest filtering", () => {
    const dimensions: number[] = [];
    const filters: number[] = [];
    const page = {
      setFilter: (filter: number) => filters.push(filter),
    };
    const textures = {
      addDynamicTexture: (_key: string, width: number, height: number) => {
        dimensions.push(width, height);
        return page;
      },
    };

    expect(pagePoolFor(textures as never, "base").acquire()).toBe(page);
    expect(dimensions).toEqual([1024, 1024]);
    expect(filters).toEqual([1]);
  });

  it("keeps Phaser's base frame while removing atlas strip frames", () => {
    const removed: string[] = [];
    let cleared = false;
    const page = {
      getFrameNames: () => ["__BASE", "s0", "s1"],
      remove: (name: string) => removed.push(name),
      clear: () => {
        cleared = true;
      },
      setFilter: () => undefined,
    };
    const textures = { addDynamicTexture: () => page, remove: () => undefined };
    const pool = pagePoolFor(textures as never, "strip");
    const acquired = pool.acquire();
    if (!acquired) throw new Error("expected strip page");

    pool.release(acquired);
    expect(pool.acquire()).toBe(page);
    expect(removed).toEqual(["s0", "s1"]);
    expect(cleared).toBe(true);
  });

  it("reports active and spare raw bytes across page classes", () => {
    const page = { setFilter: () => undefined };
    const textures = { addDynamicTexture: () => page, remove: () => undefined };
    const pool = pagePoolFor(textures as never, "base");
    const acquired = pool.acquire();
    if (!acquired) throw new Error("expected base page");
    expect(terrainPageMemoryFor(textures as never).activeUsedBytes).toBe(4 * 1024 * 1024);
    pool.release(acquired);
    expect(terrainPageMemoryFor(textures as never).spareUsedBytes).toBe(4 * 1024 * 1024);
  });
});
