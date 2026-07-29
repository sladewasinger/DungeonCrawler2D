import { describe, expect, it } from "vitest";
import { hashString } from "../../core/rng.js";
import { World } from "./world.js";
import {
  BEDROCK_MIN_HEIGHT,
  CHUNK_SIZE,
  TILE,
} from "./types.js";

describe("Bedrock world collision", () => {
  it("keeps generated Bedrock at z2 or higher and permanently impassable", () => {
    const world = new World(hashString("dev-world-1"), 1, {
      features: { voidTerrain: false },
    });
    const chunk = world.getChunk(1, -1);
    const index = chunk.tiles.findIndex((tile) => tile === TILE.Bedrock);

    expect(index).toBeGreaterThanOrEqual(0);
    const x = chunk.cx * CHUNK_SIZE + index % CHUNK_SIZE;
    const y = chunk.cy * CHUNK_SIZE + Math.floor(index / CHUNK_SIZE);
    expect(world.surfaceTileAt(x, y)).toBe(TILE.Bedrock);
    expect(world.tileAt(x, y)).toBe(TILE.Bedrock);
    expect(world.heightAt(x, y)).toBeGreaterThanOrEqual(BEDROCK_MIN_HEIGHT);
    expect(world.isWalkable(x, y)).toBe(false);
  });

  it("rejects runtime Bedrock overrides below z2", () => {
    const world = new World(hashString("bedrock-override"), 1, {
      features: { voidTerrain: false },
    });
    const chunk = world.getChunk(0, 0);
    const index = chunk.height.findIndex((height) =>
      height < BEDROCK_MIN_HEIGHT
    );
    expect(index).toBeGreaterThanOrEqual(0);
    const x = index % CHUNK_SIZE;
    const y = Math.floor(index / CHUNK_SIZE);
    expect(() =>
      world.replaceTileOverrides([{ x, y, tile: TILE.Bedrock }])
    ).toThrow("below z2");
  });
});
