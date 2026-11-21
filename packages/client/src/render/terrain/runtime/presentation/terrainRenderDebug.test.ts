import { describe, expect, it } from "vitest";
import { terrainRootVisibilityDebug } from "./terrainRenderDebug.js";

describe("terrain root visibility diagnostics", () => {
  it("reports only the active atlas root as visible when the fallback roots are hidden", () => {
    const roots = [
      fakeRoot(0, false, true),
      fakeRoot(90, false, false),
    ];

    expect(terrainRootVisibilityDebug(roots, 0)).toEqual([
      { orientation: 0, active: true, graphicsVisible: false, atlasVisible: true },
      { orientation: 90, active: false, graphicsVisible: false, atlasVisible: false },
    ]);
  });
});

function fakeRoot(
  orientation: number,
  graphicsVisible: boolean,
  atlasVisible: boolean,
) {
  return {
    orientation,
    graphics: { visible: graphicsVisible },
    atlas: { isVisible: atlasVisible },
  };
}
