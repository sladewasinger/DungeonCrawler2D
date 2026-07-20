// v1 -> v2 migration logic, in isolation (no Node fs — engine imports nothing
// but itself; the two docs/examples fixtures are exercised end-to-end by
// game-server/src/mapMigration.test.ts, which is allowed to read files).
import { describe, expect, it } from "vitest";
import { stacksToHeightField } from "./compile.js";
import { loadEditorMap, migrateMapV1 } from "./migrate.js";
import type { EditorMapV1 } from "./types.js";

// A tiny 2x2 v1 save exercising every branch: open ground, a wall, a door, a pit.
const SMALL_V1: EditorMapV1 = {
  tiles: [0, 1, 8, 0],
  heights: [0, 1, 1, -1],
  torches: [{ wx: 0, wy: 0 }],
};

describe("migrateMapV1", () => {
  it("infers a square grid from the array length when width isn't given", () => {
    const migrated = migrateMapV1(SMALL_V1);
    expect(migrated.width).toBe(2);
    expect(migrated.rows).toBe(2);
  });

  it("compiles back to the exact original tiles/heights", () => {
    const migrated = migrateMapV1(SMALL_V1);
    const compiled = stacksToHeightField(migrated.stacks, migrated.width, migrated.rows);
    expect([...compiled.tiles]).toEqual(SMALL_V1.tiles);
    for (let i = 0; i < SMALL_V1.heights.length; i++) {
      expect(compiled.height[i]).toBeCloseTo(SMALL_V1.heights[i] ?? 0, 5);
    }
  });

  it("carries torches forward unchanged", () => {
    const migrated = migrateMapV1(SMALL_V1);
    expect(migrated.torches).toEqual(SMALL_V1.torches);
  });

  it("a non-square source (explicit width) migrates correctly too", () => {
    const wide: EditorMapV1 = { tiles: [0, 0, 0, 1, 1, 1], heights: [0, 0, 0, 1, 1, 1] };
    const migrated = migrateMapV1(wide, 3);
    expect(migrated.rows).toBe(2);
    const compiled = stacksToHeightField(migrated.stacks, migrated.width, migrated.rows);
    expect([...compiled.tiles]).toEqual(wide.tiles);
  });
});

describe("loadEditorMap", () => {
  it("dispatches a v1 (no version key) save through migration", () => {
    const loaded = loadEditorMap(SMALL_V1);
    expect(loaded.version).toBe(2);
    expect(loaded.width).toBe(2);
  });

  it("passes an already-v2 save through unchanged", () => {
    const v2 = { version: 2 as const, width: 2, rows: 1, stacks: [{ walls: 0, cap: "floor", stair: null }] };
    expect(loadEditorMap(v2)).toEqual(v2);
  });

  it("rejects garbage that matches neither schema", () => {
    expect(() => loadEditorMap({ nonsense: true })).toThrow();
  });
});
