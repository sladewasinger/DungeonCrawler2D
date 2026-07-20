// THE INVARIANT THAT MATTERS MOST (explicit-heights-reskin pivot, engine lane):
// converting a generated chunk's {tiles,height} to stacks (worldgen's mechanical
// output layer, stacks/fromHeightField.ts) and compiling that back
// (stacks/compile.ts) must reproduce the ORIGINAL byte-for-byte — the live
// multiplayer world must not move a single tile. Covers 25+ seeds across floor
// terrain, the boss-arena floor, and an instanced stretch room.
import { describe, expect, it } from "vitest";
import { personalRoomChunk } from "../features/rooms.js";
import { FLOOR_CAP } from "../features/descentShared.js";
import { heightFieldToStacks, stacksToHeightField } from "../stacks/index.js";
import { CHUNK_SIZE } from "../types.js";
import { generateChunk } from "./index.js";

const SEEDS = Array.from({ length: 27 }, (_, i) => i * 104_729 + 3);
const CHUNK_COORDS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [1, 0],
  [0, 1],
  [-1, -1],
  [3, -2],
  [-2, 3],
];

function assertRoundtrip(worldSeed: number, floor: number, cx: number, cy: number): void {
  const chunk = generateChunk(worldSeed, floor, cx, cy);
  const stacks = heightFieldToStacks(chunk.tiles, chunk.height, CHUNK_SIZE, CHUNK_SIZE);
  const compiled = stacksToHeightField(stacks, CHUNK_SIZE, CHUNK_SIZE);
  expect(compiled.tiles, `seed ${worldSeed} floor ${floor} chunk (${cx},${cy}): tiles`).toEqual(chunk.tiles);
  for (let i = 0; i < chunk.height.length; i++) {
    expect(compiled.height[i], `seed ${worldSeed} floor ${floor} chunk (${cx},${cy}) tile ${i}: height`).toBeCloseTo(
      chunk.height[i] ?? 0,
      5,
    );
  }
}

describe("stack compile round-trip: byte-identical to today's generated height field", () => {
  it(
    "floor terrain, every seed x every sampled chunk coord",
    { timeout: 120_000 },
    () => {
      let checked = 0;
      for (const worldSeed of SEEDS) {
        for (const [cx, cy] of CHUNK_COORDS) {
          assertRoundtrip(worldSeed, 1, cx, cy);
          checked++;
        }
      }
      expect(checked).toBe(SEEDS.length * CHUNK_COORDS.length);
    },
  );

  it("floor 3 (deliberate height + descent structures) round-trips too", { timeout: 120_000 }, () => {
    for (const worldSeed of SEEDS) assertRoundtrip(worldSeed, 3, 0, 0);
  });

  it("FLOOR_CAP's boss arena round-trips", { timeout: 120_000 }, () => {
    for (const worldSeed of SEEDS) assertRoundtrip(worldSeed, FLOOR_CAP, 0, 0);
  });

  it("an instanced personal stretch room round-trips", { timeout: 60_000 }, () => {
    for (const worldSeed of SEEDS.slice(0, 10)) {
      const { cx, cy } = personalRoomChunk(0);
      assertRoundtrip(worldSeed, 1, cx, cy);
    }
  });
});
