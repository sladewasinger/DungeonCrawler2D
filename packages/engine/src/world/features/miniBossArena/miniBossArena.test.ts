import { describe, expect, it } from "vitest";
import { hashString } from "../../../core/rng.js";
import { CHUNK_SIZE, TILE } from "../../core/types.js";
import { World } from "../../core/world.js";
import {
  miniBossArenaForChunk,
  miniBossArenaIsStamped,
  type MiniBossArenaSite,
} from "./miniBossArena.js";
import { applyMiniBossArena } from "./miniBossArenaStamp.js";
import { assertEnlargedArena } from "./miniBossArenaTestAssertions.js";

const REPRESENTATIVE_SEEDS = [
  "ordinary-mini-boss-arena",
  "arena-platform-invariants",
  "arena-enclosure-invariants",
] as const;

interface LocatedArena {
  readonly world: World;
  readonly site: MiniBossArenaSite;
}

function locateArena(seedText: string): LocatedArena {
  const world = new World(hashString(seedText), 1);
  for (let cy = -10; cy <= 10; cy++) {
    for (let cx = -10; cx <= 10; cx++) {
      const site = miniBossArenaForChunk({
        worldSeed: world.worldSeed,
        floor: world.floor,
        generatedFloor: world.generatedFloor,
        cx,
        cy,
      });
      if (site && miniBossArenaIsStamped(world, site)) {
        return { world, site };
      }
    }
  }
  throw new Error("test seed produced no ordinary mini-boss arena");
}

describe("ordinary mini-boss arena generation", () => {
  it.each(REPRESENTATIVE_SEEDS)(
    "stamps a deterministic enlarged enclosed arena for %s",
    (seedText) => {
      const { world, site } = locateArena(seedText);
      const repeat = miniBossArenaForChunk({
        worldSeed: world.worldSeed,
        floor: world.floor,
        generatedFloor: world.generatedFloor,
        ...site.chunk,
      });
      expect(repeat).toEqual(site);
      assertEnlargedArena(world, site);
      assertArenaGeometry(world, site);
    },
  );

  it("does not place ordinary arenas on the final boss floor", () => {
    expect(miniBossArenaForChunk({
      worldSeed: 1,
      floor: 5,
      cx: 0,
      cy: 0,
    })).toBeNull();
  });

  it("does not overwrite an authored feature inside its footprint", () => {
    const { world, site } = locateArena("arena-authored-feature-guard");
    const cells = CHUNK_SIZE * CHUNK_SIZE;
    const featureTiles = new Uint8Array(cells);
    const localX = site.center.x - site.chunk.cx * CHUNK_SIZE;
    const localY = site.center.y - site.chunk.cy * CHUNK_SIZE;
    featureTiles[localY * CHUNK_SIZE + localX] = TILE.Stairs;
    const result = applyMiniBossArena({
      worldSeed: world.worldSeed,
      floor: world.floor,
      ...site.chunk,
      tiles: new Uint8Array(cells),
      featureTiles,
      featureFaces: new Uint8Array(cells),
      featureHeight: new Float32Array(cells),
      height: new Float32Array(cells),
    });
    expect(result).toBeNull();
    expect(featureTiles[localY * CHUNK_SIZE + localX]).toBe(TILE.Stairs);
  });

});

function assertArenaGeometry(world: World, site: MiniBossArenaSite): void {
  for (let y = site.bounds.y0; y <= site.bounds.y1; y++) {
    for (let x = site.bounds.x0; x <= site.bounds.x1; x++) {
      assertArenaCell({ world, site, x, y });
    }
  }
}

interface ArenaCellAssertion {
  readonly world: World;
  readonly site: MiniBossArenaSite;
  readonly x: number;
  readonly y: number;
}

function assertArenaCell(input: ArenaCellAssertion): void {
  const { world, site, x, y } = input;
  const gate = arenaHasGate(site, x, y);
  const sealedWall = arenaBoundaryContains(site, x, y) && !gate;
  const ramp = world.featureAt(x, y) === TILE.Stairs;
  const rampLanding = arenaRampLanding(site, x, y);
  const platformHeight = arenaPlatformHeightAt(site, x, y);
  const expected = expectedArenaCell({ gate, ramp, rampLanding, sealedWall, platformHeight });
  expect(world.heightAt(x, y)).toBe(expected.height);
  expect(world.tileAt(x, y)).toBe(expected.tile);
  expect(world.featureAt(x, y)).toBe(expected.feature);
  expect(world.isWalkable(x, y)).toBe(!gate && !sealedWall);
}

function expectedArenaCell(input: { readonly gate: boolean; readonly ramp: boolean; readonly rampLanding: boolean; readonly sealedWall: boolean; readonly platformHeight: number }): { height: number; tile: number; feature: number } {
  return {
    height: input.sealedWall ? 2 : input.ramp || input.rampLanding ? 0.5 : input.platformHeight,
    tile: input.ramp ? TILE.Stairs : expectedArenaTile(input.gate, input.sealedWall),
    feature: input.gate ? TILE.ArenaGate : input.ramp ? TILE.Stairs : TILE.Floor,
  };
}

function arenaRampLanding(site: MiniBossArenaSite, x: number, y: number): boolean {
  return site.platforms.some((platform) => platform.y - 1 === y && Math.abs(platform.x - x) === 1);
}

function arenaPlatformHeightAt(
  site: MiniBossArenaSite,
  x: number,
  y: number,
): number {
  const platform = site.platforms.find((spot) =>
    spot.x === x &&
    y >= spot.y &&
    y < spot.y + spot.screenDepthTiles
  );
  return platform?.height ?? 0;
}

function expectedArenaTile(gate: boolean, sealedWall: boolean): number {
  if (gate) return TILE.ArenaGate;
  return sealedWall ? TILE.Bedrock : TILE.Floor;
}

function arenaHasGate(site: MiniBossArenaSite, x: number, y: number): boolean {
  return site.gates.some((gate) => gate.x === x && gate.y === y);
}

function arenaBoundaryContains(
  site: MiniBossArenaSite,
  x: number,
  y: number,
): boolean {
  return x === site.bounds.x0 || x === site.bounds.x1 ||
    y === site.bounds.y0 || y === site.bounds.y1;
}
