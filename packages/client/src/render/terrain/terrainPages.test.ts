import { describe, expect, it } from "vitest";
import {
  CONSTRAINED_TERRAIN_PROFILE,
  DESKTOP_TERRAIN_PROFILE,
} from "./terrainDeviceProfile.js";
import {
  configureTerrainPages,
  pagePoolFor,
  terrainPageMemoryFor,
  terrainPageProfileFor,
} from "./terrainPages.js";

describe("terrain page recycling", () => {
  it("requires explicit profile configuration before any pool access", () => {
    expect(() => pagePoolFor({} as never, "base")).toThrow(/must be configured before use/);
  });

  it("keeps the first explicit profile when later device signals drift", () => {
    const textures = {};
    const equivalentDesktopProfile = { ...DESKTOP_TERRAIN_PROFILE };

    expect(configureTerrainPages(textures as never, DESKTOP_TERRAIN_PROFILE))
      .toBe(DESKTOP_TERRAIN_PROFILE);
    expect(configureTerrainPages(textures as never, equivalentDesktopProfile))
      .toBe(DESKTOP_TERRAIN_PROFILE);
    expect(terrainPageProfileFor(textures as never)).toBe(DESKTOP_TERRAIN_PROFILE);
    expect(configureTerrainPages(textures as never, CONSTRAINED_TERRAIN_PROFILE))
      .toBe(DESKTOP_TERRAIN_PROFILE);
  });

  it("preserves a constrained first configuration instead of silently selecting desktop", () => {
    const textures = {};

    configureTerrainPages(textures as never, CONSTRAINED_TERRAIN_PROFILE);

    expect(terrainPageProfileFor(textures as never)).toBe(CONSTRAINED_TERRAIN_PROFILE);
    expect(configureTerrainPages(textures as never, DESKTOP_TERRAIN_PROFILE))
      .toBe(CONSTRAINED_TERRAIN_PROFILE);
  });

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

    configureTerrainPages(textures as never, DESKTOP_TERRAIN_PROFILE);
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
    configureTerrainPages(textures as never, DESKTOP_TERRAIN_PROFILE);
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
    configureTerrainPages(textures as never, DESKTOP_TERRAIN_PROFILE);
    const pool = pagePoolFor(textures as never, "base");
    const acquired = pool.acquire();
    if (!acquired) throw new Error("expected base page");
    expect(terrainPageMemoryFor(textures as never).activeUsedBytes).toBe(4 * 1024 * 1024);
    pool.release(acquired);
    expect(terrainPageMemoryFor(textures as never).spareUsedBytes).toBe(4 * 1024 * 1024);
  });

  it("enforces a configured profile's preferred page maximum", () => {
    const textures = {
      addDynamicTexture: () => {
        throw new Error("must reject before allocation");
      },
    };
    configureTerrainPages(textures as never, {
      ...DESKTOP_TERRAIN_PROFILE,
      maximumPreferredPagePx: 512,
    });

    expect(() => pagePoolFor(textures as never, "base").acquire())
      .toThrow(/1024x1024 exceeds 512px limit/);
  });
});
