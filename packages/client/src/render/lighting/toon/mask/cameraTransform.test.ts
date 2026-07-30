import { describe, expect, it } from "vitest";
import {
  toonCameraTransform,
  toonCameraTransformChanged,
  type ToonCameraTransformSource,
} from "./cameraTransform.js";

const CAMERA: ToonCameraTransformSource = {
  x: 0,
  y: 0,
  scrollX: 10,
  scrollY: 20,
  zoom: 1,
  width: 1280,
  height: 720,
};

describe("Toon camera transform", () => {
  it("invalidates the captured mask during a cosmetic rotation tween", () => {
    const previous = toonCameraTransform(CAMERA, 0);

    expect(toonCameraTransformChanged(
      previous,
      CAMERA,
      Math.PI / 4,
    )).toBe(true);
  });

  it("retains the capture when every camera transform is unchanged", () => {
    expect(toonCameraTransformChanged(
      toonCameraTransform(CAMERA, 0),
      CAMERA,
      0,
    )).toBe(false);
  });
});
