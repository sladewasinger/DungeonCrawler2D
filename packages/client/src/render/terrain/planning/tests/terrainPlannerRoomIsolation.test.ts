import {
  CHUNK_SIZE,
  ROOM_WALL_RISE,
  TERRAIN,
  World,
  generateRoomChunk,
  hashString,
  spawnRoomChunk,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { createTerrainSource } from "../../runtime/source.js";
import {
  planTerrain,
  type TerrainSource,
} from "../terrainPlanner.js";

describe("room terrain isolation", () => {
  it("renders the sealed room shell when ordinary world VOID is disabled", () => {
    const room = spawnRoomChunk();
    const chunk = generateRoomChunk(room.cx, room.cy);
    const source = roomSource(chunk, false);
    const options = {
      bounds: {
        x: room.cx * CHUNK_SIZE,
        y: room.cy * CHUNK_SIZE,
        width: CHUNK_SIZE,
        height: CHUNK_SIZE,
      },
      orientation: 0 as const,
    };

    const plan = planTerrain(source, options);
    const enabled = planTerrain(roomSource(chunk, true), options);

    expect(plan.presentation.mode).toBe("inside");
    expect(plan.batches).toEqual(enabled.batches);
  });

  it("allows a finite dungeon view to sample the adjacent reserved plane", () => {
    const room = spawnRoomChunk();
    const world = new World(hashString("room-render-isolation"), 1, {
      features: { voidTerrain: false },
    });
    const source = createTerrainSource(world);
    const boundaryY = room.cy * CHUNK_SIZE;

    expect(() => planTerrain(source, {
      bounds: {
        x: room.cx * CHUNK_SIZE,
        y: boundaryY - 1,
        width: 1,
        height: 2,
      },
      orientation: 0,
    })).not.toThrow();
    expect(world.terrainAt(room.cx * CHUNK_SIZE, boundaryY))
      .toBe(TERRAIN.Floor);
  });
});

function roomSource(
  chunk: ReturnType<typeof generateRoomChunk>,
  voidTerrain: boolean,
): TerrainSource {
  const cellIndex = (x: number, y: number): number =>
    (y - chunk.cy * CHUNK_SIZE) * CHUNK_SIZE +
      x - chunk.cx * CHUNK_SIZE;
  return {
    voidTerrain,
    presentationAt: () => ({ mode: "inside", wallRise: ROOM_WALL_RISE }),
    terrainAt: (x, y) => chunk.terrain[cellIndex(x, y)] === TERRAIN.Void
      ? "void"
      : "floor",
    heightAt: (x, y) => chunk.height[cellIndex(x, y)] ?? 0,
  };
}
