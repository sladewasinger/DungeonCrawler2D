import { describe, expect, it } from "vitest";
import { Connection } from "../../../net/connection/connection.js";
import { finiteTerrainWorldFixture } from "../../../testing/terrainWorldFixture.js";
import type { MinimapSnapshot } from "../model/minimap/minimapTypes.js";
import { resolveHudMinimap } from "./HudMinimapSnapshot.js";

describe("Three HUD minimap snapshot", () => {
  it("builds from live player and cached world state without generating chunks", () => {
    const { world, spawn } = finiteTerrainWorldFixture();
    const player = playerAt(spawn);
    const connection = new Connection("ws://test", "Tester", "client");

    const minimap = resolveHudMinimap({ connection, world, player });

    expect(minimap).toMatchObject({ centerX: player.x, centerY: player.z });
    expect(minimap.terrain.length).toBeGreaterThan(0);
    expect(world.cachedChunkCount).toBe(0);
  });

  it("preserves the Phaser snapshot when one is supplied", () => {
    const { world, spawn } = finiteTerrainWorldFixture();
    const player = playerAt(spawn);
    const connection = new Connection("ws://test", "Tester", "client");
    const minimap = {
      centerX: 1,
      centerY: 2,
      rangeTiles: 16,
      terrain: [{ x: 1, y: 2, height: 0, walkable: true }],
      entities: [],
      landmarks: [],
    } satisfies MinimapSnapshot;

    expect(resolveHudMinimap({ connection, world, player, snapshot: { minimap } }))
      .toBe(minimap);
  });

  it("fills an empty finite snapshot from indexed terrain without loading chunks", () => {
    const { world, spawn } = finiteTerrainWorldFixture();
    const player = playerAt(spawn);
    const connection = new Connection("ws://test", "Tester", "client");
    const minimap = {
      centerX: 1,
      centerY: 2,
      rangeTiles: 16,
      terrain: [],
      entities: [],
      landmarks: [],
    } satisfies MinimapSnapshot;

    const resolved = resolveHudMinimap({ connection, world, player, snapshot: { minimap } });

    expect(resolved).not.toBe(minimap);
    expect(resolved.terrain.length).toBeGreaterThan(0);
    expect(world.cachedChunkCount).toBe(0);
  });
});

function playerAt(spawn: { readonly x: number; readonly y: number }) {
  return {
    x: spawn.x + 0.5,
    y: 0,
    z: spawn.y + 0.5,
    verticalVelocity: 0,
    grounded: true,
  };
}
