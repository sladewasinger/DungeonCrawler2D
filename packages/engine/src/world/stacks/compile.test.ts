// Unit coverage for stacksToHeightField()'s literal compile rule per tile kind.
import { describe, expect, it } from "vitest";
import { TILE } from "../core/types.js";
import { stacksToHeightField } from "./compile.js";
import type { StackTile } from "./types.js";

const bareVoid: StackTile = { height: 2, cap: null, stair: null };
const cappedFloor: StackTile = { height: 3, cap: "floor", stair: null };
const openGround: StackTile = { height: 0, cap: "floor", stair: null };
const doorTile: StackTile = { height: 1, cap: null, stair: null, feature: "doorSafeRoom" };

describe("stacksToHeightField", () => {
  it("compiles a capless stack to a heightless Void terrain cell", () => {
    const { tiles, height } = stacksToHeightField([bareVoid], 1, 1);
    expect(tiles[0]).toBe(TILE.Void);
    expect(height[0]).toBe(2);
  });

  it("compiles height=h with a cap to a walkable Floor at height h", () => {
    const { tiles, height } = stacksToHeightField([cappedFloor], 1, 1);
    expect(tiles[0]).toBe(TILE.Floor);
    expect(height[0]).toBe(3);
  });

  it("compiles height=0 WITH a cap to open ground (Floor height 0)", () => {
    const { tiles, height } = stacksToHeightField([openGround], 1, 1);
    expect(tiles[0]).toBe(TILE.Floor);
    expect(height[0]).toBe(0);
  });

  it("a negative height value with a cap round-trips a generated pit/chasm floor untouched", () => {
    const pit: StackTile = { height: -2, cap: "floor", stair: null };
    const { tiles, height } = stacksToHeightField([pit], 1, 1);
    expect(tiles[0]).toBe(TILE.Floor);
    expect(height[0]).toBe(-2);
  });

  it("a capless zero-height stack remains Void", () => {
    const sunkenWall: StackTile = { height: 0, cap: null, stair: null };
    const { tiles, height } = stacksToHeightField([sunkenWall], 1, 1);
    expect(tiles[0]).toBe(TILE.Void);
    expect(height[0]).toBe(0);
  });

  it("a feature tile overrides tile type and takes its height from height", () => {
    const { tiles, height } = stacksToHeightField([doorTile], 1, 1);
    expect(tiles[0]).toBe(TILE.DoorSafeRoom);
    expect(height[0]).toBe(1);
  });

  it("a stair with an explicit stair.height override uses it verbatim, ignoring neighbors", () => {
    // Mirrors worldgen's mechanical conversion, which
    // already know the real height and must reproduce it byte-for-byte — including
    // cliffs.ts's opportunistic single-tile ramps, which move a fixed slope step
    // from ONE side rather than splitting the total delta (a value no generic
    // "average of anchors" formula could reproduce; stacksRoundtrip.test.ts's
    // 25+-seed round-trip is what proved that formula wrong).
    const stacks: StackTile[] = [
      { height: 0, cap: "floor", stair: null },
      { height: 0, cap: null, stair: { dir: 0, height: 0.63 } },
      { height: 2, cap: "floor", stair: null },
    ];
    const { tiles, height } = stacksToHeightField(stacks, 3, 1);
    expect(tiles[1]).toBe(TILE.Stairs);
    expect(height[1]).toBeCloseTo(0.63, 5);
  });

  it("a height-less stair interpolates a single tread to the midpoint of its flanking anchors", () => {
    // Mirrors the editor's fresh paintStairsAt authoring (EditableWorld.ts, client
    // lane): no height to give, so "the engine figures out what height it is at."
    const stacks: StackTile[] = [
      { height: 0, cap: "floor", stair: null },
      { height: 0, cap: null, stair: { dir: 1 } },
      { height: 2, cap: "floor", stair: null },
    ];
    const { tiles, height } = stacksToHeightField(stacks, 3, 1);
    expect(tiles[1]).toBe(TILE.Stairs);
    expect(height[1]).toBeCloseTo(1, 5);
  });

  // Re-baselined for docs/R2-STAIRS-SPEC.md section 2's midpoint contract
  // (Wave R2 compact stairs): a tread's compiled height is its tile-CENTER
  // value, low + delta*(k-0.5)/stepCount — not an even split of the full
  // rise across stepCount+1 gaps. Only multi-tile runs move (a 1-tile run
  // is numerically identical either way, per the spec's own note).
  it("a height-less 1-tile run midpoints between anchors 1 z-unit apart (the spec's own worked example)", () => {
    const stacks: StackTile[] = [
      { height: 0, cap: "floor", stair: null },
      { height: 0, cap: null, stair: { dir: 1 } },
      { height: 1, cap: "floor", stair: null },
    ];
    const { tiles, height } = stacksToHeightField(stacks, 3, 1);
    expect(tiles[1]).toBe(TILE.Stairs);
    expect(height[1]).toBeCloseTo(0.5, 5);
  });

  it("a height-less multi-tile run divides the full rise into per-tile midpoints, not an even split", () => {
    // The spec's own worked example: 0 -> 4 over 4 tiles gives 0.5, 1.5, 2.5, 3.5.
    const stacks: StackTile[] = [
      { height: 0, cap: "floor", stair: null },
      { height: 0, cap: null, stair: { dir: 1 } },
      { height: 0, cap: null, stair: { dir: 1 } },
      { height: 0, cap: null, stair: { dir: 1 } },
      { height: 0, cap: null, stair: { dir: 1 } },
      { height: 4, cap: "floor", stair: null },
    ];
    const { tiles, height } = stacksToHeightField(stacks, 6, 1);
    expect([tiles[1], tiles[2], tiles[3], tiles[4]]).toEqual([TILE.Stairs, TILE.Stairs, TILE.Stairs, TILE.Stairs]);
    expect(height[1]).toBeCloseTo(0.5, 5);
    expect(height[2]).toBeCloseTo(1.5, 5);
    expect(height[3]).toBeCloseTo(2.5, 5);
    expect(height[4]).toBeCloseTo(3.5, 5);
  });

  it("an authoring mismatch (anchors differing by more than the tile count) is surfaced by the formula, not silently smoothed to a clean 1-per-tile slope", () => {
    // 2 height-less tiles between anchors 3 apart -> stepCount=2, delta=3, a
    // 1.5 z/tile slope — a locked regression, not a validated/rejected case
    // (compile has no error path; this documents what a malformed run
    // actually compiles to, so a future change can't drift it unnoticed).
    const stacks: StackTile[] = [
      { height: 0, cap: "floor", stair: null },
      { height: 0, cap: null, stair: { dir: 1 } },
      { height: 0, cap: null, stair: { dir: 1 } },
      { height: 3, cap: "floor", stair: null },
    ];
    const { height } = stacksToHeightField(stacks, 4, 1);
    expect(height[1]).toBeCloseTo(0.75, 5);
    expect(height[2]).toBeCloseTo(2.25, 5);
  });

  it("a run mixing an explicit-height stair next to a height-less one resolves independently", () => {
    const stacks: StackTile[] = [
      { height: 0, cap: "floor", stair: null },
      { height: 0, cap: null, stair: { dir: 1, height: 0.9 } },
      { height: 2, cap: "floor", stair: null },
    ];
    const { height } = stacksToHeightField(stacks, 3, 1);
    expect(height[1]).toBeCloseTo(0.9, 5);
  });
});
