// Grafted from the "caverns" candidate: a rare deep chasm room with a
// guaranteed flat bridge deck — a real knockback-off-ledge kill zone
// (docs/PORT_PLAN.md's worldgen redesign brief).

import { describe, expect, it } from "vitest";
import { hashString } from "../../core/rng.js";
import { TILE } from "../types.js";
import { CHASM_DEPTH } from "./height.js";
import { generateChunk } from "./index.js";
import { floodFromBorder } from "./test-support.js";

const SEED = hashString("chasm-test-world");
const FLOOR = 1;

function findChasmChunk(range: number): { cx: number; cy: number } | null {
  for (let cx = -range; cx <= range; cx++) {
    for (let cy = -range; cy <= range; cy++) {
      const chunk = generateChunk(SEED, FLOOR, cx, cy);
      for (let i = 0; i < chunk.tiles.length; i++) {
        if (chunk.tiles[i] === TILE.Floor && (chunk.height[i] ?? 0) <= CHASM_DEPTH + 0.01) {
          return { cx, cy };
        }
      }
    }
  }
  return null;
}

describe("chasm rifts", () => {
  it("appear somewhere in a wide region and reach the full depth budget", () => {
    const found = findChasmChunk(24);
    expect(found, "no chasm room found in scan range").not.toBeNull();
  });

  it("a chasm room carries a guaranteed flat (height 0) bridge across its depth", () => {
    const found = findChasmChunk(24);
    expect(found).not.toBeNull();
    if (!found) return;
    const chunk = generateChunk(SEED, FLOOR, found.cx, found.cy);

    let sawDeep = false;
    let sawBridge = false;
    for (let i = 0; i < chunk.tiles.length; i++) {
      if (chunk.tiles[i] !== TILE.Floor) continue;
      const h = chunk.height[i] ?? 0;
      expect(h).toBeGreaterThanOrEqual(CHASM_DEPTH - 0.01);
      if (h <= CHASM_DEPTH + 0.01) sawDeep = true;
      if (Math.abs(h) < 1e-6) sawBridge = true;
    }
    expect(sawDeep).toBe(true);
    expect(sawBridge).toBe(true);
  });

  it("stays fully connected (no orphan pocket at the pit's edge)", () => {
    const found = findChasmChunk(24);
    expect(found).not.toBeNull();
    if (!found) return;
    const chunk = generateChunk(SEED, FLOOR, found.cx, found.cy);
    const reached = floodFromBorder(chunk.tiles);
    for (let i = 0; i < chunk.tiles.length; i++) {
      if (chunk.tiles[i] === TILE.Wall) continue;
      expect(reached[i], `chunk ${found.cx},${found.cy} tile ${i} is an orphan pocket`).toBe(1);
    }
  });
});
