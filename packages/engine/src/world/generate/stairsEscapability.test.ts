// Split out of stairsInvariant.test.ts (this repo's per-file line budget):
// a pit's ramp must be walkable back OUT, ascending — not just walkable IN,
// descending, which is always free ("drops are free"). Also the
// docs/R2-STAIRS-SPEC.md section 3e generator invariant this escapability
// rule depends on: no walkable-both-ways stair may descend into a true
// chasm death zone.

import { describe, expect, it } from "vitest";
import { CHASM_DEATH_Z, STEP_UP } from "../../core/constants.js";
import { isSafeRoomChunk, isStairsChunk } from "../features/fixed.js";
import { entryClimbDir } from "../stairs.js";
import { CHUNK_SIZE, TILE } from "../types.js";
import { World } from "../world.js";
import { generateChunk } from "./index.js";
import { CLIMB_DIRS, forEachChunkCoord, scanStairs, type WorldPoint } from "./test-support.js";
import { CHUNK_RANGE, FLOOR, SEEDS } from "./stairsInvariant.test.js";

/** Any floor at or below this sits in a deliberate sunken (pit) variant, not a small lip. */
const SUNKEN_THRESHOLD = -STEP_UP;
type GridPoint = readonly [number, number];
const GRID_DIRECTIONS: GridPoint[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function pitLandingsInChunk(input: { seed: number; world: World; cx: number; cy: number }): WorldPoint[] {
  const { seed, world, cx, cy } = input;
  const chunk = generateChunk({ worldSeed: seed, floor: FLOOR, cx, cy });
  return Array.from(chunk.tiles).flatMap((tile, index) => landingAtStair({ tile, index, world, cx, cy }));
}

function landingAtStair(input: { tile: number; index: number; world: World; cx: number; cy: number }): WorldPoint[] {
  if (input.tile !== TILE.Stairs) return [];
  const x = input.cx * CHUNK_SIZE + input.index % CHUNK_SIZE;
  const y = input.cy * CHUNK_SIZE + Math.floor(input.index / CHUNK_SIZE);
  const direction = entryClimbDir(input.world, x, y);
  if (direction === null) return [];
  const [dx, dy] = CLIMB_DIRS[direction] as GridPoint;
  const landing = { x: x - dx, y: y - dy };
  const height = input.world.heightAt(landing.x, landing.y);
  return height < SUNKEN_THRESHOLD && height > CHASM_DEATH_Z ? [landing] : [];
}

/**
 * The low-side landing of every pit ramp found in the scanned region: for
 * each valid Stairs tile whose climb axis descends into a sunken (pit,
 * not death-zone chasm — see CHASM_DEATH_Z) interior, the interior tile
 * one step past its low end. That's the exact tile a room's own carveRamp
 * (height.ts) guarantees reaches the room's true depth — the natural
 * "did this room's deliberate ramp actually connect?" probe, unlike
 * scanning for the single globally-deepest sunken tile, which can land in
 * an unrelated, doorway-less room this ramp was never meant to serve.
 *
 * Safe-room/stairs chunks are skipped: applyFlattenedFeature (features/
 * fixed.ts) stamps a hand-placed blend over whatever the procedural
 * room/height pass left there, a wholly different authoring contract
 * from a plain room's carveRamp — job #4 (safe-room door geometry) owns
 * that surface, not this pit/chasm generator invariant.
 */
function findPitRampLandings(seed: number, world: World): WorldPoint[] {
  const landings: WorldPoint[] = [];
  const seen = new Set<string>();
  forEachChunkCoord(CHUNK_RANGE, ({ cx, cy }) => {
    const worldChunk = { worldSeed: seed, floor: FLOOR, cx, cy };
    if (isSafeRoomChunk(worldChunk) || isStairsChunk(worldChunk)) return;
    for (const landing of pitLandingsInChunk({ seed, world, cx, cy })) {
      const key = `${landing.x},${landing.y}`;
      if (!seen.has(key)) { seen.add(key); landings.push(landing); }
    }
  });
  return landings;
}

const ESCAPE_STEP = 0.2; // sub-tile resolution: coarse whole-tile hops miss a real single-tile ramp's climb
const ESCAPE_RADIUS = 16; // tiles: a pit's escape route is always local (one room + its doorway)

function gridToWorld(start: WorldPoint, [x, y]: GridPoint): WorldPoint {
  return { x: start.x + 0.5 + x * ESCAPE_STEP, y: start.y + 0.5 + y * ESCAPE_STEP };
}

function canEnterGridPoint(input: { world: World; start: WorldPoint; currentHeight: number; max: number; visited: Set<string>; point: GridPoint }): boolean {
  const [x, y] = input.point;
  if (input.visited.has(`${x},${y}`) || Math.abs(x) > input.max || Math.abs(y) > input.max) return false;
  const point = gridToWorld(input.start, input.point);
  const tileX = Math.floor(point.x);
  const tileY = Math.floor(point.y);
  if (!input.world.isWalkable(tileX, tileY)) return false;
  return input.world.tileAt(tileX, tileY) === TILE.Stairs || input.world.groundAt(point.x, point.y) - input.currentHeight <= STEP_UP;
}

function escapeNeighbors(input: { world: World; start: WorldPoint; currentHeight: number; max: number; visited: Set<string>; point: GridPoint }): GridPoint[] {
  const [x, y] = input.point;
  return GRID_DIRECTIONS.map(([dx, dy]) => [x + dx, y + dy] as GridPoint).filter((point) => canEnterGridPoint({ ...input, point }));
}

/**
 * Fine-grained flood-fill from `start` using the REAL continuous ground
 * rule (world.groundAt, rise <= STEP_UP, drops free) at sub-tile
 * resolution: a whole-tile BFS can misjudge a legitimate single-Stairs-
 * tile ramp as "too steep" because it only samples tile centers a full
 * unit apart — see test-support.ts's bfsChunks, which stays whole-tile for
 * its own (cheaper, less precise) connectivity tests.
 *
 * docs/R2-STAIRS-SPEC.md section 4d's REPLACE: the neighbor gate glues to
 * any destination cell whose TILE is Stairs, regardless of the groundAt
 * delta — matching the engine's own on-stair glide (physics.ts), which
 * bypasses STEP_UP entirely while grounded on a real Stairs tile. The
 * plain `groundAt` delta check below already passes a 1.0-slope compact
 * ramp at this flood's 0.2 sub-tile resolution (0.2 < STEP_UP), so this is
 * faithfulness to the real walkability rule, not a bug fix — but it's the
 * rule a future coarser probe or a steeper authored slope would need.
 */
function canEscapeSunken(world: World, start: WorldPoint, targetHeight: number): boolean {
  const maxG = Math.round(ESCAPE_RADIUS / ESCAPE_STEP);
  const visited = new Set<string>(["0,0"]);
  const queue: GridPoint[] = [[0, 0]];
  let head = 0;
  while (head < queue.length) {
    const current = queue[head++] as GridPoint;
    const p = gridToWorld(start, current);
    const h = world.groundAt(p.x, p.y);
    if (h >= targetHeight) return true;
    for (const next of escapeNeighbors({ world, start, currentHeight: h, max: maxG, visited, point: current })) {
      visited.add(`${next[0]},${next[1]}`);
      queue.push(next);
    }
  }
  return false;
}

// The ascending-only blind spot that shipped the CONFIRMED inescapable-pit
// bug (docs/ROADMAP.md's austin-dungeon-prod-1 (37,7) repro): the tests in
// stairsInvariant.test.ts only prove a deliberate-height floor is reachable
// WALKING IN from a corridor (descending is always free — "drops are
// free"). A pit's ramp must ALSO be walkable back OUT, ascending, which is
// where a broken/orphaned chain (pit depth -> partial ramp -> pit depth
// again, never reaching rim height) actually traps a player.
describe("a pit's deepest floor can walk back OUT (negative-height transitions)", () => {
  for (const seed of SEEDS) {
    it(`holds for seed ${seed}`, () => {
      const world = new World(seed, FLOOR);
      const landings = findPitRampLandings(seed, world);
      expect(landings.length, `seed ${seed}: no pit-ramp landing found in scan range`).toBeGreaterThan(0);
      for (const landing of landings) {
        const escaped = canEscapeSunken(world, landing, SUNKEN_THRESHOLD);
        expect(
          escaped,
          `seed ${seed}: pit floor at (${landing.x},${landing.y}) has no walking exit to level ` +
            `ground — an orphaned/broken ramp chain (docs/ROADMAP.md's inescapable-pit bug)`,
        ).toBe(true);
      }
    });
  }
});

// docs/R2-STAIRS-SPEC.md section 3e's generator invariant, resolving Open
// Question 1: a stair intended to be walkable in BOTH directions must have
// its low (-dir) anchor strictly above CHASM_DEATH_Z, or a body gliding
// down it dies partway (an effective, un-signposted death-slide) instead of
// reaching a real, escapable floor. height.ts's applyRoomHeight resolves
// this by giving chasms NO descending terrain-stair at all (a sheer rim,
// crossed only by the guaranteed bridge) — so every remaining Stairs tile,
// with no exception, must satisfy the invariant.
describe("no walkable stair's low anchor sits at or below CHASM_DEATH_Z", () => {
  for (const seed of SEEDS) {
    it(`holds for seed ${seed}`, () => {
      const world = new World(seed, FLOOR);
      for (const { x, y } of scanStairs({ seed, floor: FLOOR, chunkRange: CHUNK_RANGE })) {
        const dir = entryClimbDir(world, x, y);
        if (dir === null) continue;
        const [dx, dy] = CLIMB_DIRS[dir] as [number, number];
        const low = world.heightAt(x - dx, y - dy);
        expect(
          low,
          `seed ${seed}: stair (${x},${y})'s low anchor ${low} sits at/below CHASM_DEATH_Z ` +
            `(${CHASM_DEATH_Z}) — a body gliding down it would die partway instead of escaping`,
        ).toBeGreaterThan(CHASM_DEATH_Z);
      }
    });
  }
});
