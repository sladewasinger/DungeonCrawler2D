import { describe, expect, it } from "vitest";
import { subtleSlopeEdgesAt } from "./subtleSlope.js";

function flatWithDip(dipHeight: number): { heightAt: (wx: number, wy: number) => number } {
  return { heightAt: (wx, wy) => (wx === 0 && wy === 0 ? dipHeight : 0) };
}

describe("subtleSlopeEdgesAt", () => {
  it("flags all four sides for an isolated -0.5 pocket surrounded by flat 0 ground (the invisible-pit repro)", () => {
    const world = flatWithDip(-0.5);
    const edges = subtleSlopeEdgesAt(world, 0, 0);
    expect(edges).toMatchObject({ north: true, south: true, east: true, west: true });
    expect(edges.strength).toBeGreaterThan(0);
  });

  it("stays flat (no edges) for a delta at or below the noise-floor MIN_DELTA (0.25)", () => {
    const world = flatWithDip(-0.2);
    expect(subtleSlopeEdgesAt(world, 0, 0)).toMatchObject({ north: false, south: false, east: false, west: false });
  });

  it("defers to the real face system once the delta reaches WALL_FACE_MIN_DROP (0.75) — out of band, not this module's job", () => {
    const world = flatWithDip(-0.75);
    expect(subtleSlopeEdgesAt(world, 0, 0)).toMatchObject({ north: false, south: false, east: false, west: false });
  });

  it("only flags a HIGHER neighbor's side — a raised bump gets no edges from this module (that's ownFace/cliffMask territory once it clears 0.75, and invisible below it by design)", () => {
    const world = flatWithDip(0.5);
    expect(subtleSlopeEdgesAt(world, 0, 0)).toMatchObject({ north: false, south: false, east: false, west: false });
  });

  it("strength scales with how deep into the band the steepest edge sits", () => {
    const shallow = subtleSlopeEdgesAt(flatWithDip(-0.26), 0, 0).strength;
    const deep = subtleSlopeEdgesAt(flatWithDip(-0.7), 0, 0).strength;
    expect(deep).toBeGreaterThan(shallow);
  });
});
