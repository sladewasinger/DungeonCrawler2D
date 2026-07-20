// Guards the schema's literal feature list against silent drift from STACK_FEATURE.
import { describe, expect, it } from "vitest";
import { STACK_FEATURE } from "./types.js";
import { editorMapV1Schema, editorMapV2Schema } from "./schema.js";

describe("editor map schemas", () => {
  it("accepts every StackFeature value in a stack tile", () => {
    for (const feature of Object.values(STACK_FEATURE)) {
      const parsed = editorMapV2Schema.parse({
        version: 2,
        width: 1,
        rows: 1,
        stacks: [{ walls: 1, cap: null, stair: null, feature }],
      });
      expect(parsed.stacks[0]?.feature).toBe(feature);
    }
  });

  it("rejects a v1 save missing tiles/heights", () => {
    expect(editorMapV1Schema.safeParse({ tiles: [] }).success).toBe(false);
  });

  it("rejects an unknown feature string", () => {
    const bad = { version: 2, width: 1, rows: 1, stacks: [{ walls: 1, cap: null, stair: null, feature: "bogus" }] };
    expect(editorMapV2Schema.safeParse(bad).success).toBe(false);
  });
});
