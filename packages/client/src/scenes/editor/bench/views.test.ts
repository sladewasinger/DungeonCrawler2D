// Bench area-view replacement coverage keeps tile identity stable while effect identity changes.
import { describe, expect, it } from "vitest";
import { EditableWorld } from "../EditableWorld.js";
import { benchAreaTileViews, createBench, paintArea } from "./index.js";

describe("benchAreaTileViews", () => {
  it("keeps the tile id stable when oil is replaced by fire", () => {
    const state = createBench(new EditableWorld());
    paintArea(state, 3, 6, "area-oil");
    const oil = benchAreaTileViews(state)[0];

    paintArea(state, 3, 6, "area-fire");
    const fire = benchAreaTileViews(state)[0];

    expect([oil?.id, fire?.id]).toEqual(["3,6", "3,6"]);
    expect([oil?.effectId, fire?.effectId]).toEqual(["area-oil", "area-fire"]);
  });
});
