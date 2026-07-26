import type { StairVisual } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { VIEW_ORIENTATIONS } from "../view/viewOrientation.js";
import { stairRenderState } from "./drawStairSurface.js";

describe("stair production surface selection", () => {
  it("selects a filled stepped surface for every direction and camera orientation", () => {
    for (const orientation of VIEW_ORIENTATIONS) {
      for (let direction = 0; direction < 4; direction++) {
        const stairVisual = { direction } as StairVisual;
        const state = stairRenderState(stairVisual, { orientation } as never);

        expect(state.surface).toBe("stepped");
        expect(state.screenDirection).toBeGreaterThanOrEqual(0);
        expect(state.screenDirection).toBeLessThan(4);
      }
    }
  });

  it("uses ordinary floor art only when no stair visual exists", () => {
    expect(stairRenderState(null, { orientation: 0 } as never))
      .toEqual({ screenDirection: 0, surface: "floor" });
  });
});
