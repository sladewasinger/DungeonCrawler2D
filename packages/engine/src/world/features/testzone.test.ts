import { describe, expect, it } from "vitest";
import { hashString } from "../../core/rng";
import { TEST_SPAWN } from "./testzone";
import { TILE } from "../types";
import { World } from "../world";

const SEED = hashString("test-world");

describe("test zone (dev proving ground)", () => {
  const world = new World(SEED, 1);

  it("stamps the structures at their fixed coordinates on any seed/floor", () => {
    const other = new World(hashString("another-world"), 3);
    for (const w of [world, other]) {
      expect(w.heightAt(14, 14)).toBe(5); // hill summit
      expect(w.heightAt(15, 35)).toBe(2); // pillar 1 top
      expect(w.heightAt(18, 35)).toBe(0); // 2-tile gap floor
      expect(w.heightAt(50, 13)).toBe(8); // drop tower top band
      expect(w.heightAt(26, 47)).toBe(2); // chasm west platform
      expect(w.heightAt(30, 47)).toBe(0); // chasm gap
      expect(w.heightAt(30, 52)).toBe(1); // chasm exit ramp
      // Every authored climb is a SINGLE-STEP entry (one staircase
      // object), never a multi-tile tread ramp.
      expect(w.tileAt(13, 35)).toBe(TILE.Stairs); // pillar staircase
      expect(w.heightAt(13, 35)).toBe(1);
      expect(w.tileAt(40, 19)).toBe(TILE.Stairs); // tower lane entry step
      expect(w.heightAt(40, 19)).toBe(5);
      expect(w.tileAt(40, 20)).toBe(TILE.Floor); // landing between climbs
      expect(w.heightAt(40, 20)).toBe(4);
    }
  });

  it("keeps the whole zone walkable, and the spawn point flat", () => {
    for (let wy = 12; wy < 52; wy += 4) {
      for (let wx = 12; wx < 52; wx += 4) {
        expect(world.isWalkable(wx, wy), `tile ${wx},${wy}`).toBe(true);
      }
    }
    const sx = Math.floor(TEST_SPAWN.x);
    const sy = Math.floor(TEST_SPAWN.y);
    expect(world.isWalkable(sx, sy)).toBe(true);
    expect(world.heightAt(sx, sy)).toBe(0);
  });

  it("hill and tower ramps are climbable with the walk rule (≤ +1 per step)", () => {
    // Hill: walk from the flat east side straight to the summit.
    for (let wx = 24; wx > 14; wx--) {
      const rise = world.heightAt(wx - 1, 14) - world.heightAt(wx, 14);
      expect(rise, `hill step at x=${wx}`).toBeLessThanOrEqual(1);
    }
    // Tower ramp: walk north up the western stair column.
    for (let wy = 27; wy > 12; wy--) {
      const rise = world.heightAt(40, wy - 1) - world.heightAt(40, wy);
      expect(rise, `tower ramp step at y=${wy}`).toBeLessThanOrEqual(1);
    }
    // Tower bands from the ramp: stepping east onto each band is ≤ +1.
    for (const wy of [24, 20, 16, 13]) {
      const rise = world.heightAt(42, wy) - world.heightAt(41, wy);
      expect(rise, `ramp→band at y=${wy}`).toBeLessThanOrEqual(1);
    }
  });

  it("pillar gaps are jumpable-scale, not walkable", () => {
    // From the gap floor, the pillar walls are a +2 rise — blocked on
    // foot (STEP_UP is 1), crossed by jumping.
    expect(world.heightAt(19, 35)).toBe(0);
    expect(world.heightAt(20, 35)).toBe(2);
  });
});
