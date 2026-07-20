// Unit coverage for bossArena.ts's pure chunk/position selection: the arena
// exists on FLOOR_CAP only, and its gate/spawn positions land inside the
// chunk its own chunk getter names. The sealed-ring/single-gate geometry
// itself is covered against real generated chunks in
// generate/bossArenaInvariant.test.ts (repairCliffs/sealInteriorPockets
// etc. run after this file's own stamp, so only the final generated chunk
// is a trustworthy geometry source).
import { describe, expect, it } from "vitest";
import { CHUNK_SIZE } from "../types.js";
import { bossArenaChunk, bossArenaGatePosition, bossArenaSpawnAnchor, isBossArenaChunk } from "./bossArena.js";
import { FLOOR_CAP } from "./descentShared.js";

const SEEDS = Array.from({ length: 30 }, (_, i) => i * 7919 + 13);

describe("boss arena chunk selection", () => {
  it("exists on FLOOR_CAP only", () => {
    for (const seed of SEEDS) {
      for (let floor = 1; floor < FLOOR_CAP; floor++) expect(bossArenaChunk(seed, floor)).toBeNull();
      expect(bossArenaChunk(seed, FLOOR_CAP)).not.toBeNull();
    }
  });

  it("isBossArenaChunk agrees with the chunk getter, and only that one chunk", () => {
    const seed = SEEDS[0] as number;
    const chunk = bossArenaChunk(seed, FLOOR_CAP);
    expect(chunk).not.toBeNull();
    if (!chunk) return;
    expect(isBossArenaChunk(seed, FLOOR_CAP, chunk.cx, chunk.cy)).toBe(true);
    expect(isBossArenaChunk(seed, FLOOR_CAP, chunk.cx, chunk.cy + 1)).toBe(false);
  });

  it("gate and spawn-anchor positions land inside the arena's own chunk, and are null off FLOOR_CAP", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      expect(bossArenaGatePosition({ worldSeed: seed, floor: 1 })).toBeNull();
      expect(bossArenaSpawnAnchor({ worldSeed: seed, floor: 1 })).toBeNull();

      const chunk = bossArenaChunk(seed, FLOOR_CAP);
      const gate = bossArenaGatePosition({ worldSeed: seed, floor: FLOOR_CAP });
      const spawn = bossArenaSpawnAnchor({ worldSeed: seed, floor: FLOOR_CAP });
      expect(chunk).not.toBeNull();
      expect(gate).not.toBeNull();
      expect(spawn).not.toBeNull();
      if (!chunk || !gate || !spawn) continue;
      expect(Math.floor(gate.x / CHUNK_SIZE)).toBe(chunk.cx);
      expect(Math.floor(gate.y / CHUNK_SIZE)).toBe(chunk.cy);
      expect(Math.floor(spawn.x / CHUNK_SIZE)).toBe(chunk.cx);
      expect(Math.floor(spawn.y / CHUNK_SIZE)).toBe(chunk.cy);
      expect(gate).not.toEqual(spawn); // gate sits on the south wall, spawn at the true center
    }
  });
});
