import { describe, expect, it } from "vitest";
import { vi } from "vitest";

vi.mock("./rootPresentation.js", () => ({
  terrainPresentationPlanKey: () => "test",
}));

import { TerrainPresentationState } from "./terrainPresentationState.js";

describe("TerrainPresentationState", () => {
  it("does not invalidate repeatedly when visibility remains absent", () => {
    const state = new TerrainPresentationState();

    expect(state.setVisibility(null)).toBe(false);
    expect(state.setVisibility(null)).toBe(false);
  });
});
