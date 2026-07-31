import { describe, expect, it } from "vitest";
import { petIdleFrame } from "./petAssetFrame.js";

describe("pet asset idle frames", () => {
  it("finds the configured idle frame in each sheet", () => {
    expect(petIdleFrame("pet-dog", 448)).toEqual({
      x: 0,
      y: 384,
      width: 32,
      height: 32,
    });
  });

  it("rejects unknown pet definitions", () => {
    expect(petIdleFrame("pet-unknown", 128)).toBeNull();
  });
});
