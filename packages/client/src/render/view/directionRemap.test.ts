import { describe, expect, it } from "vitest";
import {
  screenNorthWorldDirection,
  screenSlotFor,
  screenSouthWorldDirection,
  stairTreadAxis,
  type CompassDir,
} from "./directionRemap.js";
import { VIEW_ORIENTATIONS, type ViewOrientation } from "./viewOrientation.js";
import { worldToView } from "./viewTransform.js";

const WORLD_VECTOR: Record<CompassDir, { x: number; y: number }> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};

describe("screenNorthWorldDirection", () => {
  it("cycles N -> E -> S -> W as orientation climbs", () => {
    expect(screenNorthWorldDirection(0)).toBe("N");
    expect(screenNorthWorldDirection(90)).toBe("E");
    expect(screenNorthWorldDirection(180)).toBe("S");
    expect(screenNorthWorldDirection(270)).toBe("W");
  });
});

describe("screenSouthWorldDirection", () => {
  it("is always the opposite compass point from screenNorthWorldDirection", () => {
    const opposite: Record<CompassDir, CompassDir> = { N: "S", S: "N", E: "W", W: "E" };
    for (const o of VIEW_ORIENTATIONS) {
      expect(screenSouthWorldDirection(o)).toBe(opposite[screenNorthWorldDirection(o)]);
    }
  });

  it("cycles S -> W -> N -> E (wall faces per brief step 2)", () => {
    expect(screenSouthWorldDirection(0)).toBe("S");
    expect(screenSouthWorldDirection(90)).toBe("W");
    expect(screenSouthWorldDirection(180)).toBe("N");
    expect(screenSouthWorldDirection(270)).toBe("E");
  });
});

describe("screenSlotFor agrees with viewTransform's point math", () => {
  it("the world direction reported as screen-south renders with a positive view Y", () => {
    for (const o of VIEW_ORIENTATIONS) {
      const dir = screenSouthWorldDirection(o);
      const v = worldToView(WORLD_VECTOR[dir], o);
      expect(v.y).toBeGreaterThan(0);
      expect(v.x).toBeCloseTo(0, 9);
    }
  });

  it("the world direction reported as screen-north renders with a negative view Y", () => {
    for (const o of VIEW_ORIENTATIONS) {
      const dir = screenNorthWorldDirection(o);
      const v = worldToView(WORLD_VECTOR[dir], o);
      expect(v.y).toBeLessThan(0);
      expect(v.x).toBeCloseTo(0, 9);
    }
  });

  it("round-trips: screenSlotFor(screenNorthWorldDirection(o), o) === 'N'", () => {
    for (const o of VIEW_ORIENTATIONS) {
      expect(screenSlotFor(screenNorthWorldDirection(o), o)).toBe("N");
    }
  });
});

describe("stairTreadAxis — the brief's own worked example", () => {
  const NORTH_SOUTH_ORIENTATIONS: readonly [ViewOrientation, "horizontal" | "vertical"][] = [
    [0, "horizontal"],
    [180, "horizontal"],
    [90, "vertical"],
    [270, "vertical"],
  ];

  it("a staircase climbing world-north: horizontal lines at 0/180, vertical at 90/270", () => {
    for (const [orientation, expected] of NORTH_SOUTH_ORIENTATIONS) {
      expect(stairTreadAxis("N", orientation)).toBe(expected);
    }
  });

  it("a world east/west climb is always the opposite axis from a north/south one", () => {
    for (const o of VIEW_ORIENTATIONS) {
      const ns = stairTreadAxis("N", o);
      const ew = stairTreadAxis("E", o);
      expect(ew).not.toBe(ns);
    }
  });
});
