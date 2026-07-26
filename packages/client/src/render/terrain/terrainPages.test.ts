import { describe, expect, it } from "vitest";
import { pagePoolFor } from "./terrainPages.js";

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
    };
    const pool = pagePoolFor({} as never, "strip");

    pool.release(page as never);
    expect(pool.acquire()).toBe(page);
    expect(removed).toEqual(["s0", "s1"]);
    expect(cleared).toBe(true);
  });
});
