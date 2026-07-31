import { describe, expect, it } from "vitest";
import { LEVEL } from "../core/level.js";
import { TERRAIN, TILE } from "../core/types.js";
import { World } from "../core/world.js";
import { COMBAT_SANDBOX_LAYOUT } from "./combatSandboxLayout.js";

describe("Combat Sandbox arena generation", () => {
  const world = new World(7, 1, LEVEL.CombatSandbox);

  it("keeps the configured arena interior flat", () => {
    expect(world.terrainAt(25, 25)).toBe(TERRAIN.Floor);
    expect(world.surfaceTileAt(25, 25)).toBe(TILE.Floor);
    expect(world.heightAt(25, 25)).toBe(0);
    expect(world.isWalkable(25, 25)).toBe(true);
  });

  it("surrounds the arena with a two-high solid perimeter", () => {
    const { wallHeight } = COMBAT_SANDBOX_LAYOUT.arena;
    expect(world.surfaceTileAt(0, 25)).toBe(TILE.Bedrock);
    expect(world.heightAt(0, 25)).toBe(wallHeight);
    expect(world.isWalkable(0, 25)).toBe(false);
  });

  it("leaves the world beyond the perimeter as void", () => {
    expect(world.terrainAt(-1, 25)).toBe(TERRAIN.Void);
    expect(world.surfaceTileAt(-1, 25)).toBe(TILE.Void);
    expect(world.isWalkable(-1, 25)).toBe(false);
    expect(world.terrainAt(50, 25)).toBe(TERRAIN.Void);
  });

  it("authors the configured corner blocks one tile high", () => {
    for (const block of COMBAT_SANDBOX_LAYOUT.blocks) {
      expect(world.terrainAt(block.x, block.y)).toBe(TERRAIN.Floor);
      expect(world.heightAt(block.x, block.y)).toBe(block.height);
    }
  });
});
