// Pure paint logic for the EFFECTS/SPAWN brushes (Epic 7.11): painting mutates the live
// bench directly, repainting a cell replaces what was there, erase targets only the
// active brush's layer, and RESET clears everything back to blank.
import { describe, expect, it } from "vitest";
import { EditableWorld } from "../EditableWorld.js";
import { eraseBenchCell, paintArea, paintEnemy, paintItem, resetBench } from "./paint.js";
import { createBenchState } from "./state.js";

function bench() {
  return createBenchState(new EditableWorld());
}

describe("bench paint", () => {
  it("paints an area tile brush onto the live AreaSystem", () => {
    const state = bench();
    paintArea(state, 5, 5, "area-fire");
    expect(state.areas.defAt(5, 5)).toBe("area-fire");
  });

  it("ignores an area id outside the brush catalog", () => {
    const state = bench();
    paintArea(state, 5, 5, "not-a-real-area");
    expect(state.areas.defAt(5, 5)).toBeNull();
  });

  it("repainting a cell with a different area replaces it (fire onto oil becomes fire)", () => {
    const state = bench();
    paintArea(state, 3, 3, "area-oil");
    paintArea(state, 3, 3, "area-fire");
    expect(state.areas.defAt(3, 3)).toBe("area-fire");
  });

  it("paints an enemy stamp keyed by cell, replacing whatever was there before", () => {
    const state = bench();
    paintEnemy(state, 2, 2, "slime");
    expect(state.enemies.get("2,2")?.entity.defId).toBe("slime");
    paintEnemy(state, 2, 2, "skeleton");
    expect(state.enemies.size).toBe(1);
    expect(state.enemies.get("2,2")?.entity.defId).toBe("skeleton");
  });

  it("paints a ground-item stamp", () => {
    const state = bench();
    paintItem(state, 4, 4, "raw-meat");
    expect(state.items.get("4,4")).toMatchObject({ defId: "raw-meat", x: 4.5, y: 4.5 });
  });

  it("erases only the requested layer at a cell", () => {
    const state = bench();
    paintArea(state, 1, 1, "area-wet");
    paintEnemy(state, 1, 1, "slime");
    eraseBenchCell(state, 1, 1, "enemy");
    expect(state.enemies.has("1,1")).toBe(false);
    expect(state.areas.defAt(1, 1)).toBe("area-wet");
    eraseBenchCell(state, 1, 1, "area");
    expect(state.areas.defAt(1, 1)).toBeNull();
  });

  it("RESET clears every painted layer, stops SIMULATE, and re-centers the dummy", () => {
    const state = bench();
    paintArea(state, 6, 6, "area-poison");
    paintEnemy(state, 7, 7, "spitter");
    paintItem(state, 8, 8, "raw-meat");
    state.running = true;
    resetBench(state);
    expect(state.areas.size).toBe(0);
    expect(state.enemies.size).toBe(0);
    expect(state.items.size).toBe(0);
    expect(state.running).toBe(false);
    expect(state.dummy.hp).toBe(state.dummy.maxHp);
  });
});
