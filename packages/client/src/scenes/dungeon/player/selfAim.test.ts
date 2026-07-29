import type Phaser from "phaser";
import { describe, expect, it } from "vitest";
import type { RenderPose } from "../orchestration/state.js";
import { resolveSelfAimAngle } from "./selfAim.js";

const RENDER = { x: 0, y: 0, z: 0 } as RenderPose;
const POINTER = { x: 100, y: 0 } as Phaser.Input.Pointer;
const CAMERA = {
  getWorldPoint: () => ({ x: 100, y: 0 }),
} as unknown as Phaser.Cameras.Scene2D.Camera;

describe("self aim presentation", () => {
  it("uses movement-facing in assisted modes instead of the mouse", () => {
    const angle = resolveSelfAimAngle({
      assistedAim: true,
      faceX: 0,
      faceY: -1,
      render: RENDER,
      camera: CAMERA,
      pointer: POINTER,
    });
    expect(angle).toBeCloseTo(-Math.PI / 2);
  });

  it("preserves mouse-relative desktop aiming outside assisted modes", () => {
    const angle = resolveSelfAimAngle({
      assistedAim: false,
      faceX: 0,
      faceY: -1,
      render: RENDER,
      camera: CAMERA,
      pointer: POINTER,
    });
    expect(angle).toBeCloseTo(0);
  });
});
