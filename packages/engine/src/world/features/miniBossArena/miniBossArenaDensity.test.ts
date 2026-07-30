import { describe, expect, it } from "vitest";
import { hashString } from "../../../core/rng.js";
import { WORLD_GENERATION_TUNING } from "../../generate/tuning.js";
import {
  miniBossArenaEligibleForChunk,
  miniBossArenaPlacementRoll,
  type MiniBossArenaChunk,
} from "./miniBossArena.js";

const SAMPLE_RADIUS_CHUNKS = 24;

describe("mini-boss arena density", () => {
  it("selects roughly one in three eligible chunks before layout validation", () => {
    const chunks = sampleChunks(hashString("mini-boss-arena-density"));
    const eligible = chunks.filter(miniBossArenaEligibleForChunk);
    const selected = eligible.filter(passesFrequency);
    const density = selected.length / eligible.length;

    expect(WORLD_GENERATION_TUNING.miniBossArena.eligibleChunkFrequency).toBe(3);
    expect(density).toBeGreaterThan(0.28);
    expect(density).toBeLessThan(0.39);
  });
});

function passesFrequency(chunk: MiniBossArenaChunk): boolean {
  return miniBossArenaPlacementRoll(chunk) %
    WORLD_GENERATION_TUNING.miniBossArena.eligibleChunkFrequency === 0;
}

function sampleChunks(worldSeed: number): MiniBossArenaChunk[] {
  const chunks: MiniBossArenaChunk[] = [];
  for (let cy = -SAMPLE_RADIUS_CHUNKS; cy <= SAMPLE_RADIUS_CHUNKS; cy++) {
    for (let cx = -SAMPLE_RADIUS_CHUNKS; cx <= SAMPLE_RADIUS_CHUNKS; cx++) {
      chunks.push({ worldSeed, floor: 1, cx, cy });
    }
  }
  return chunks;
}
