import { TILE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { isVoidTile } from "./heightShade.js";

describe("isVoidTile", () => {
  it("recognizes explicit void identity", () => {
    expect(isVoidTile(TILE.Void)).toBe(true);
    expect(isVoidTile(TILE.Floor)).toBe(false);
  });
});
