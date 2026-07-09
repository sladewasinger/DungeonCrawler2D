import { describe, expect, it } from "vitest";
import { hashString } from "../../core/rng";
import { LEVEL } from "../level";
import { TILE } from "../types";
import { World } from "../world";
import { SANDBOX_SPAWN } from "./testzone";

const SEED = hashString("test-world");

describe("sandbox level", () => {
  const world = new World(SEED, 1, LEVEL.Sandbox);

  it("is fixed across seeds and floors", () => {
    const other = new World(hashString("another-world"), 3, LEVEL.Sandbox);
    for (const w of [world, other]) {
      expect(w.heightAt(14, 14)).toBe(5);
      expect(w.heightAt(15, 35)).toBe(2);
      expect(w.heightAt(18, 35)).toBe(0);
      expect(w.heightAt(50, 13)).toBe(8);
      expect(w.heightAt(26, 47)).toBe(2);
      expect(w.heightAt(30, 47)).toBe(0);
      expect(w.heightAt(30, 52)).toBe(1);
      expect(w.tileAt(13, 35)).toBe(TILE.Stairs);
      expect(w.heightAt(13, 35)).toBe(1);
      expect(w.tileAt(40, 19)).toBe(TILE.Stairs);
      expect(w.heightAt(40, 19)).toBe(5);
      expect(w.heightAt(40, 20)).toBe(4);
      expect(w.tileAt(10, 57)).toBe(TILE.Stairs);
      expect(w.heightAt(18, 57)).toBe(7);
    }
  });

  it("keeps the traversal space walkable and bounds it with high walls", () => {
    for (let y = 12; y < 52; y += 4) {
      for (let x = 12; x < 52; x += 4) expect(world.isWalkable(x, y), `tile ${x},${y}`).toBe(true);
    }
    expect(world.isWalkable(Math.floor(SANDBOX_SPAWN.x), Math.floor(SANDBOX_SPAWN.y))).toBe(true);
    expect(world.heightAt(Math.floor(SANDBOX_SPAWN.x), Math.floor(SANDBOX_SPAWN.y))).toBe(0);
    expect(world.tileAt(-1, 0)).toBe(TILE.Wall);
    expect(world.heightAt(-1, 0)).toBeGreaterThan(5);
  });

  it("keeps hill, tower, and long-stair rises walkable", () => {
    for (let x = 24; x > 14; x--) expect(world.heightAt(x - 1, 14) - world.heightAt(x, 14)).toBeLessThanOrEqual(1);
    for (let y = 27; y > 12; y--) expect(world.heightAt(40, y - 1) - world.heightAt(40, y)).toBeLessThanOrEqual(1);
    for (let x = 5; x <= 18; x++) expect(world.heightAt(x, 57) - world.heightAt(x - 1, 57)).toBeLessThanOrEqual(1);
  });
});
