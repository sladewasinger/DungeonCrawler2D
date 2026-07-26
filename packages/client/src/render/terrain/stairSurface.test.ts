import { TILE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import {
  drawsVoidUnderlay,
  renderedSurfaceHeight,
  underlaySurface,
} from "./stairSurface.js";

describe("stair surface presentation", () => {
  it("anchors a half-height stair to its upper whole-height tile", () => {
    expect(renderedSurfaceHeight(TILE.Stairs, -0.5)).toBe(0);
    expect(renderedSurfaceHeight(TILE.Stairs, 0.5)).toBe(1);
  });

  it("keeps a stair out of the purple void underlay", () => {
    expect(drawsVoidUnderlay(TILE.Stairs, -0.5)).toBe(false);
    expect(drawsVoidUnderlay(TILE.Floor, -1)).toBe(true);
  });

  it("continues pit floor art while preserving true chasm void underlays", () => {
    expect(underlaySurface(TILE.Floor, -1)).toBe("floor");
    expect(underlaySurface(TILE.Floor, -2)).toBe("void");
    expect(underlaySurface(TILE.Stairs, -0.5)).toBeNull();
    expect(underlaySurface(TILE.Floor, 0)).toBeNull();
  });
});
