import { TILE, stairRampAt, type StairView } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { steppedStairSurface } from "../../render/terrain/sideStair.js";
import { EditableWorld } from "./EditableWorld.js";

const STAIR_X = 10;
const STAIR_Y = 10;

function northStairWorld(): EditableWorld {
  const world = new EditableWorld();
  world.placeStairTransition(
    { x: STAIR_X, y: STAIR_Y },
    { x: STAIR_X, y: STAIR_Y - 1 },
  );
  return world;
}

function liveGroundAt(view: StairView, x: number, y: number): number {
  return stairRampAt(view, x, y) ?? view.heightAt(Math.floor(x), Math.floor(y));
}

function liveStairHeightAt(view: StairView, x: number, y: number): number | null {
  if (view.tileAt(Math.floor(x), Math.floor(y)) !== TILE.Stairs) return null;
  return stairRampAt(view, x, y);
}

describe("EditableWorld live stair-height parity", () => {
  it("matches the live continuous ramp contract at sub-tile samples", () => {
    const editor = northStairWorld();
    const samples = [
      { y: STAIR_Y + 0.125, expected: 0.875 },
      { y: STAIR_Y + 0.5, expected: 0.5 },
      { y: STAIR_Y + 0.875, expected: 0.125 },
    ];

    expect(editor.heightAt(STAIR_X, STAIR_Y)).toBe(0.5);
    for (const sample of samples) {
      const x = STAIR_X + 0.5;
      expect(editor.groundAt(x, sample.y)).toBeCloseTo(sample.expected);
      expect(editor.groundAt(x, sample.y)).toBeCloseTo(
        liveGroundAt(editor, x, sample.y),
      );
      expect(editor.stairHeightAt(x, sample.y)).toBeCloseTo(
        liveStairHeightAt(editor, x, sample.y) ?? Number.NaN,
      );
    }
  });

  it("feeds the stepped renderer the same varying heights as the live contract", () => {
    const editor = northStairWorld();
    const editorSurface = steppedStairSurface(
      STAIR_X,
      STAIR_Y,
      0,
      (x, y) => editor.groundAt(x, y),
    );
    const liveSurface = steppedStairSurface(
      STAIR_X,
      STAIR_Y,
      0,
      (x, y) => liveGroundAt(editor, x, y),
    );

    expect(editorSurface.bands.map(({ height }) => height)).toEqual(
      liveSurface.bands.map(({ height }) => height),
    );
    expect(new Set(editorSurface.bands.map(({ height }) => height)).size).toBeGreaterThan(1);
  });

  it("keeps non-stair ground scalar and reports no stair-only height", () => {
    const editor = northStairWorld();
    expect(editor.groundAt(STAIR_X + 0.5, STAIR_Y + 1.5)).toBe(0);
    expect(editor.stairHeightAt(STAIR_X + 0.5, STAIR_Y + 1.5)).toBeNull();
  });
});
