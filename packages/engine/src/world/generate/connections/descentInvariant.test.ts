// Multi-seed invariants for the StairwayUp/StairwayDown landmark (Epic
// 7.14, docs/ASSUMPTIONS.md #12x): the structure's platform is actually
// reachable from the wider corridor network (descentLink.ts's connector,
// wired in generate/index.ts's stampDescentFeature), same BFS methodology
// safeRoomLink.test.ts already established for the safe-room kiosk.
import { describe, expect, it } from "vitest";
import { FLOOR_CAP, stairwayDownChunk, stairwayDownPosition, stairwayUpChunk, stairwayUpPosition } from "../../features/descent/descent.js";
import { CHUNK_SIZE, TILE, TOPOLOGY } from "../../core/types.js";
import { generateChunk } from "../index.js";
import { reachesNeighborChunk, type ChunkCache, type WorldPoint } from "../test-support.js";

const SEEDS = Array.from({ length: 16 }, (_, i) => i * 7919 + 13);

function tileAt(seed: number, floor: number, p: WorldPoint): number {
  const cx = Math.floor(p.x / CHUNK_SIZE);
  const cy = Math.floor(p.y / CHUNK_SIZE);
  const chunk = generateChunk({ worldSeed: seed, floor: floor, cx: cx, cy: cy });
  const i = (p.y - cy * CHUNK_SIZE) * CHUNK_SIZE + (p.x - cx * CHUNK_SIZE);
  return chunk.tiles[i] ?? TOPOLOGY.Uncarved;
}

function downPositions(): Array<{ seed: number; floor: number; position: WorldPoint }> {
  return SEEDS.flatMap((seed) => Array.from({ length: FLOOR_CAP - 1 }, (_, index) => index + 1)
    .map((floor) => ({ seed, floor, position: stairwayDownPosition({ worldSeed: seed, floor }) })))
    .filter((entry): entry is { seed: number; floor: number; position: WorldPoint } => entry.position !== null);
}

describe("StairwayDown/StairwayUp reachability", () => {
  it("StairwayDown's own position is real walkable Floor, on floors 1..FLOOR_CAP-1", () => {
    const positions = downPositions();
    for (const { seed, floor, position } of positions) {
      expect(tileAt(seed, floor, position), `seed ${seed} floor ${floor}`).toBe(TILE.Floor);
    }
    expect(positions.length).toBeGreaterThan(50);
  }, 120_000);

  it("StairwayDown's platform reaches the wider corridor network", () => {
    let checked = 0;
    for (const seed of SEEDS.slice(0, 10)) {
      const floor = 1;
      const chunk = stairwayDownChunk({ worldSeed: seed, floor });
      const pos = stairwayDownPosition({ worldSeed: seed, floor });
      expect(chunk).not.toBeNull();
      expect(pos).not.toBeNull();
      if (!chunk || !pos) continue;
      const cache: ChunkCache = new Map();
      const reachesNeighbor = reachesNeighborChunk({ seed, floor, cache }, pos);
      expect(reachesNeighbor, `seed ${seed}: StairwayDown pad never leaves its own chunk`).toBe(true);
      checked++;
    }
    expect(checked).toBe(10);
  });

  it("StairwayUp's platform likewise reaches the wider corridor network", () => {
    let checked = 0;
    for (const seed of SEEDS.slice(0, 10)) {
      const floor = 2;
      const chunk = stairwayUpChunk({ worldSeed: seed, floor });
      const pos = stairwayUpPosition({ worldSeed: seed, floor });
      expect(chunk).not.toBeNull();
      expect(pos).not.toBeNull();
      if (!chunk || !pos) continue;
      const cache: ChunkCache = new Map();
      const reachesNeighbor = reachesNeighborChunk({ seed, floor, cache }, pos);
      expect(reachesNeighbor, `seed ${seed}: StairwayUp pad never leaves its own chunk`).toBe(true);
      checked++;
    }
    expect(checked).toBe(10);
  });
});
