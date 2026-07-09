import { describe, expect, it } from "vitest";
import { GRAVITY, JUMP_VELOCITY, STEP_UP } from "../core/constants";
import { hashString } from "../core/rng";
import { PLATFORM_TIER_STEP, hasPlatformCluster, platformLootSpots } from "./platforms";
import { CORRIDOR_HALF_WIDTH, chunkCenter, corridorSegments, distToCorridor } from "./terrain";
import { CHUNK_SIZE } from "./types";
import { World } from "./world";

const SEED = hashString("test-world");
const FLOOR = 1;

function findClusterChunks(range: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let cy = -range; cy <= range; cy++) {
    for (let cx = -range; cx <= range; cx++) {
      if (hasPlatformCluster(SEED, FLOOR, cx, cy)) out.push([cx, cy]);
    }
  }
  return out;
}

describe("ruin platform clusters", () => {
  it("appear at a meaningful rate", () => {
    const clusters = findClusterChunks(6); // 13×13 chunks
    expect(clusters.length).toBeGreaterThan(10);
  });

  it("tiers rise in jump-clearable steps (physics invariant)", () => {
    // Jump apex must clear one tier, and one tier must exceed STEP_UP —
    // platforms are for jumping, not walking.
    const apex = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY);
    expect(apex).toBeGreaterThan(PLATFORM_TIER_STEP);
    expect(PLATFORM_TIER_STEP).toBeGreaterThan(STEP_UP);
  });

  it("loot spots sit on tops that rise a jumpable +2 from nearby ground", () => {
    const world = new World(SEED, FLOOR);
    let checked = 0;
    for (const [cx, cy] of findClusterChunks(6)) {
      for (const spot of platformLootSpots(SEED, FLOOR, cx, cy)) {
        const sx = Math.floor(spot.x);
        const sy = Math.floor(spot.y);
        const top = world.heightAt(sx, sy);
        // The top must be a real platform (something lower to jump from)
        // AND a stage exactly one jumpable tier below must sit within
        // hop distance — the climb works stage by stage.
        let lowest = Infinity;
        let hasStage = false;
        for (let dy = -4; dy <= 4; dy++) {
          for (let dx = -4; dx <= 4; dx++) {
            if (!world.isWalkable(sx + dx, sy + dy)) continue;
            const nh = world.heightAt(sx + dx, sy + dy);
            lowest = Math.min(lowest, nh);
            if (Math.abs(top - PLATFORM_TIER_STEP - nh) < 0.11) hasStage = true;
          }
        }
        expect(top - lowest).toBeGreaterThanOrEqual(PLATFORM_TIER_STEP - 1e-6);
        expect(hasStage).toBe(true);
        checked++;
      }
      if (checked > 8) break;
    }
    expect(checked).toBeGreaterThan(4);
  });

  it("never raises the corridor itself (connectivity guarantee)", () => {
    const world = new World(SEED, FLOOR);
    for (const [cx, cy] of findClusterChunks(4)) {
      const segs = corridorSegments(SEED, FLOOR, cx, cy);
      const center = chunkCenter(SEED, FLOOR, cx, cy);
      // Sample along the corridor through this chunk: tiles on the
      // centerline must not carry mesa rises (they may still slope with
      // the base terrain ramps).
      for (let t = -CHUNK_SIZE / 2; t <= CHUNK_SIZE / 2; t += 2) {
        const wx = Math.round(center.x) + t;
        const wy = Math.round(center.y);
        if (distToCorridor(segs, wx, wy) > CORRIDOR_HALF_WIDTH) continue;
        const h = world.heightAt(wx, wy);
        const west = world.heightAt(wx - 1, wy);
        // A mesa edge on the corridor would be a sudden +2 wall.
        expect(Math.abs(h - west)).toBeLessThanOrEqual(PLATFORM_TIER_STEP);
      }
    }
  });
});
