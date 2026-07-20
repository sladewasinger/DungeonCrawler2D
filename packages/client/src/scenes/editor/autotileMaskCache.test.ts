import { describe, expect, it } from "vitest";
import { AutotileMaskCache } from "./autotileMaskCache.js";
import { EditableWorld } from "./EditableWorld.js";

describe("AutotileMaskCache", () => {
  it("rebuildAll reads an isolated wall as fully bordered (mask4 = 0)", () => {
    const world = new EditableWorld();
    world.paintWallAt(5, 5);
    const cache = new AutotileMaskCache();
    cache.rebuildAll(world, 20);
    expect(cache.get(5, 5)?.mask4).toBe(0);
    expect(cache.get(5, 5)?.edges).toEqual({ north: true, east: true, south: true, west: true });
  });

  it("rebuildAll reads a 2-wide horizontal run's shared edge as open on both sides", () => {
    const world = new EditableWorld();
    world.paintWallAt(5, 5);
    world.paintWallAt(6, 5);
    const cache = new AutotileMaskCache();
    cache.rebuildAll(world, 20);
    expect(cache.get(5, 5)?.edges.east).toBe(false);
    expect(cache.get(6, 5)?.edges.west).toBe(false);
    expect(cache.get(5, 5)?.edges.north).toBe(true);
  });

  it("resolveAround updates the painted cell and its 8 neighbors", () => {
    const world = new EditableWorld();
    const cache = new AutotileMaskCache();
    cache.rebuildAll(world, 20); // all bare floor

    world.paintWallAt(5, 5);
    world.paintWallAt(6, 5); // inside (5,5)'s 8-neighborhood
    cache.resolveAround(world, 5, 5);

    expect(cache.get(5, 5)?.mask4).toBe(0b0010); // E neighbor is now wall
    expect(cache.get(6, 5)?.edges.west).toBe(false);
  });

  it("resolveAround leaves cells outside the painted cell's 8-neighborhood stale (no full-map recompute)", () => {
    const world = new EditableWorld();
    const cache = new AutotileMaskCache();
    cache.rebuildAll(world, 20); // all bare floor: every cell reads mask4=0

    world.paintWallAt(5, 5);
    world.paintWallAt(15, 15);
    world.paintWallAt(16, 15); // gives (15,15) a real east wall neighbor once resolved

    cache.resolveAround(world, 5, 5); // nowhere near (15,15)/(16,15)

    // (5,5) is freshly resolved...
    expect(cache.get(5, 5)?.mask4).toBe(0);
    // ...but (15,15) still reports its pre-paint (all-floor) reading — resolveAround
    // never touched it, proving the cache does NOT silently recompute the whole grid.
    expect(cache.get(15, 15)?.edges.east).toBe(true);

    cache.resolveAround(world, 15, 15);
    expect(cache.get(15, 15)?.edges.east).toBe(false);
  });

  it("get() is undefined for a cell that has never been resolved", () => {
    const cache = new AutotileMaskCache();
    expect(cache.get(0, 0)).toBeUndefined();
  });
});
