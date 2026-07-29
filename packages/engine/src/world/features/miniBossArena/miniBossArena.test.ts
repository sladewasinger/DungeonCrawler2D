import { describe, expect, it } from "vitest";
import { hashString } from "../../../core/rng.js";
import { CHUNK_SIZE, TILE } from "../../core/types.js";
import { World } from "../../core/world.js";
import {
  miniBossArenaForChunk,
  type MiniBossArenaSite,
} from "./miniBossArena.js";
import { applyMiniBossArena } from "./miniBossArenaStamp.js";

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
        cx,
        cy,
      });
      if (site) return { world, site };
    }
  }
  throw new Error("test seed produced no ordinary mini-boss arena");
}

describe("ordinary mini-boss arena generation", () => {
  it("stamps deterministic two-high walls and one to three feature gates", () => {
    const { world, site } = locateArena("ordinary-mini-boss-arena");
    const repeat = miniBossArenaForChunk({
      worldSeed: world.worldSeed,
      floor: world.floor,
      ...site.chunk,
    });
    expect(repeat).toEqual(site);
    expect(site.gates.length).toBeGreaterThanOrEqual(1);
    expect(site.gates.length).toBeLessThanOrEqual(3);
    assertArenaGeometry(world, site);
  });

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
  expect(world.heightAt(x, y)).toBe(sealedWall ? 2 : 0);
  expect(world.tileAt(x, y)).toBe(expectedArenaTile(gate, sealedWall));
  expect(world.featureAt(x, y)).toBe(gate ? TILE.ArenaGate : TILE.Floor);
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
