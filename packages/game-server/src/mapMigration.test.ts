// Exercises @dc2d/engine's v1->v2 editor-map migration against the real
// docs/examples fixtures (a migration test per fixture, explicit-heights
// pivot's serialization contract) — lives here, not in packages/engine,
// because reading them needs Node fs, which the engine package may not
// import (docs/ENGINEERING_STANDARDS.md's import-boundary rule).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadEditorMap, stacksToHeightField, type EditorMapV1 } from "@dc2d/engine";
import { describe, expect, it } from "vitest";

const EXAMPLES_DIR = fileURLToPath(new URL("../../../docs/examples/", import.meta.url));

function readFixture(name: string): EditorMapV1 {
  return JSON.parse(readFileSync(`${EXAMPLES_DIR}${name}`, "utf8")) as EditorMapV1;
}

const FIXTURES = ["user-broken-heights-z4-z6.json", "user-kiosk-terrace-example.json"];

describe("editor-map v1->v2 migration, docs/examples fixtures", () => {
  for (const name of FIXTURES) {
    it(`${name}: migrates and compiles back to the exact original tiles/heights`, () => {
      const raw = readFixture(name);
      const migrated = loadEditorMap(raw);
      expect(migrated.version).toBe(2);
      expect(migrated.width * migrated.rows).toBe(raw.tiles.length);

      const compiled = stacksToHeightField(migrated.stacks, migrated.width, migrated.rows);
      expect([...compiled.tiles]).toEqual([...raw.tiles]);
      for (let i = 0; i < raw.heights.length; i++) {
        expect(compiled.height[i]).toBeCloseTo(raw.heights[i] ?? 0, 5);
      }
    });

    it(`${name}: torches survive the migration unchanged`, () => {
      const raw = readFixture(name);
      const migrated = loadEditorMap(raw);
      expect(migrated.torches ?? []).toEqual(raw.torches ?? []);
    });
  }
});
