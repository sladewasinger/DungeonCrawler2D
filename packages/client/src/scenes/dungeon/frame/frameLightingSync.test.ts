import { describe, expect, it } from "vitest";
import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import type { LightSource } from "../../../render/lighting/core/lightSource.js";
import { torchInCameraView } from "./frameLightingSync.js";

const VIEW = {
  x: 0,
  y: 0,
  right: SCREEN_TILE_PX,
  bottom: SCREEN_TILE_PX,
} as unknown as Phaser.Geom.Rectangle;

function torch(x: number): LightSource {
  return {
    id: `torch-${x}`,
    x,
    y: 0,
    color: 0xff9e3d,
    radiusTiles: 1,
    kind: "torch",
    seed: 0,
  };
}

describe("torch camera-edge visibility", () => {
  it("keeps a constrained torch flame within one tile of the view", () => {
    expect(torchInCameraView(torch(-0.5), VIEW, true)).toBe(true);
    expect(torchInCameraView(torch(-1.5), VIEW, true)).toBe(false);
  });

  it("preserves the standard two-tile flame margin", () => {
    expect(torchInCameraView(torch(-1.5), VIEW, false)).toBe(true);
  });
});
