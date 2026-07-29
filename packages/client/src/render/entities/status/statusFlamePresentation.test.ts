import { describe, expect, it } from "vitest";
import {
  AREA_ACTOR_FIRE_FLAMES,
  AREA_FIRE_BASE_FLAME,
} from "../../../vfx/areas/presentation/areaVisualStyle.js";
import {
  statusFlameAlpha,
  statusFlameDepth,
  statusFlameOffset,
} from "./statusFlamePresentation.js";

describe("attached fire presentation", () => {
  it("keeps the approved three two-times actor flames without spreading them", () => {
    expect(AREA_FIRE_BASE_FLAME.scale).toBe(4);
    expect(AREA_ACTOR_FIRE_FLAMES.scale).toBe(2);
    expect(AREA_ACTOR_FIRE_FLAMES.count).toBe(3);
    expect(AREA_ACTOR_FIRE_FLAMES.offsets).toEqual([
      [-0.24, -0.22],
      [0.22, -0.48],
      [-0.04, -0.72],
    ]);
  });

  it("keeps attached flames above their actor without escaping the row depth band", () => {
    const bodyDepth = 3_450;
    const flameDepth = statusFlameDepth(bodyDepth);
    expect(flameDepth).toBeGreaterThan(bodyDepth);
    expect(flameDepth).toBeLessThan(3_500);
  });

  it("uses stable configured offsets and deterministic per-sprite phases", () => {
    expect(statusFlameOffset(1)).toEqual(statusFlameOffset(1));
    expect(statusFlameAlpha(42, 1, 800)).toBe(statusFlameAlpha(42, 1, 800));
    expect(statusFlameAlpha(42, 1, 800)).not.toBe(statusFlameAlpha(42, 2, 800));
  });
});
