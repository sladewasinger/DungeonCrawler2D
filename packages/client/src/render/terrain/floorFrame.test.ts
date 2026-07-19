// Headless tests for floor variant/sanctuary selection — no Phaser involved.
import { ZONE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { floorFrame, isNearEdge } from "./floorFrame.js";

const PLAIN = /^floor_[15]$/;
const DECOR = /^floor_[234678]$/;

describe("floorFrame", () => {
  it("always picks floor_sanctuary in a sanctuary zone, regardless of position", () => {
    expect(floorFrame(3, 9, ZONE.Sanctuary, false)).toBe("floor_sanctuary");
    expect(floorFrame(-40, 12, ZONE.Sanctuary, true)).toBe("floor_sanctuary");
  });

  it("picks a stable floor_1..8 variant outside sanctuary, deterministic per position", () => {
    const frame = floorFrame(5, 5, ZONE.None, false);
    expect(frame).toMatch(/^floor_[1-8]$/);
    expect(floorFrame(5, 5, ZONE.None, false)).toBe(frame);
  });

  it("varies across positions (not one constant variant everywhere)", () => {
    const frames = new Set<string>();
    for (let x = 0; x < 20; x++) frames.add(floorFrame(x, 0, ZONE.None, false));
    expect(frames.size).toBeGreaterThan(1);
  });

  it("open-center tiles are plain stone the large majority of the time", () => {
    let plain = 0;
    const total = 300;
    for (let x = 0; x < total; x++) {
      if (PLAIN.test(floorFrame(x, 1000, ZONE.None, false))) plain++;
    }
    expect(plain / total).toBeGreaterThan(0.75);
  });

  it("decor shows up more often near an edge than in an open center", () => {
    let openDecor = 0;
    let edgeDecor = 0;
    const total = 400;
    for (let x = 0; x < total; x++) {
      if (DECOR.test(floorFrame(x, 2000, ZONE.None, false))) openDecor++;
      if (DECOR.test(floorFrame(x, 3000, ZONE.None, true))) edgeDecor++;
    }
    expect(edgeDecor).toBeGreaterThan(openDecor);
  });
});

describe("isNearEdge", () => {
  it("is false when no orthogonal neighbor is an edge", () => {
    expect(isNearEdge(() => false)).toBe(false);
  });

  it("is true when any single orthogonal neighbor is an edge", () => {
    expect(isNearEdge((dx, dy) => dx === 0 && dy === -1)).toBe(true);
  });
});
