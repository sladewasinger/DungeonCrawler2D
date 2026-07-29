import { describe, expect, it } from "vitest";
import {
  FLOOR_FIRE_FLAME_PRESENTATION,
  FIRE_SPARK_PRESENTATION,
  floorFireParticleScale,
} from "./fireParticlePresentation.js";

describe("floor fire particle recipes", () => {
  it("emits rising flame sprites across the authored half-to-double scale range", () => {
    expect(floorFireParticleScale("flame")).toEqual({
      start: 2,
      end: 0.5,
      random: true,
    });
    expect(FLOOR_FIRE_FLAME_PRESENTATION.frame).toBe("area_fire_flame");
    expect(FLOOR_FIRE_FLAME_PRESENTATION.speed.min).toBeGreaterThan(0);
  });

  it("keeps embers and sparks in the established four-times language", () => {
    expect(floorFireParticleScale("ember")).toEqual({
      start: 3,
      end: 0.6,
    });
    expect(floorFireParticleScale("spark")).toEqual({
      start: 4,
      end: 0,
    });
    expect(FIRE_SPARK_PRESENTATION.frame).toBe("chunk_tiny");
  });
});
