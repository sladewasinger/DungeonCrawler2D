import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import { resetViewOrientation, setViewOrientation } from "../../view/transform/viewState.js";
import { afterEach, describe, expect, it } from "vitest";
import {
  darknessScreenSpaceTransform,
  darknessRevealStamp,
  sameDarknessRevealCamera,
} from "./darknessRevealProjection.js";

const CAMERA = {
  centerX: 32,
  centerY: -64,
  rotation: 0,
  zoom: 1.25,
  viewportWidth: 1280,
  viewportHeight: 720,
};
const TEXTURE_SCALE = { x: 4, y: 4 };
const ANCHOR = {
  tileX: 4,
  tileY: 6,
  anchorX: 4.25,
  anchorY: 6.75,
  strength: 1,
  groundHeight: 2,
  brushRadiusTiles: 1,
  brushAlpha: 1,
} as const;

const ORIENTATIONS = [
  { orientation: 0, x: 4.25, y: 6.75 },
  { orientation: 90, x: 6.75, y: -4.25 },
  { orientation: 180, x: -4.25, y: -6.75 },
  { orientation: 270, x: -6.75, y: 4.25 },
] as const;

afterEach(() => resetViewOrientation());

describe("darkness reveal projection", () => {
  it("invalidates a fixed-screen reveal when the camera moves or zooms", () => {
    expect(sameDarknessRevealCamera(CAMERA, { ...CAMERA })).toBe(true);
    expect(sameDarknessRevealCamera(CAMERA, { ...CAMERA, centerX: 33 })).toBe(false);
    expect(sameDarknessRevealCamera(CAMERA, { ...CAMERA, centerY: -63 })).toBe(false);
    expect(sameDarknessRevealCamera(CAMERA, { ...CAMERA, rotation: 0.1 })).toBe(false);
    expect(sameDarknessRevealCamera(CAMERA, { ...CAMERA, zoom: 1.5 })).toBe(false);
    expect(sameDarknessRevealCamera(null, CAMERA)).toBe(false);
  });

  for (const projection of ORIENTATIONS) {
    it(`uses the fractional anchor at ${projection.orientation} degrees`, () => {
      setViewOrientation(projection.orientation);
      expect(darknessRevealStamp(ANCHOR, CAMERA, TEXTURE_SCALE)).toEqual({
        x: (CAMERA.viewportWidth / 2 +
          (projection.x * SCREEN_TILE_PX - CAMERA.centerX) * CAMERA.zoom) /
          TEXTURE_SCALE.x,
        y: (CAMERA.viewportHeight / 2 +
          (projection.y * SCREEN_TILE_PX - 2 * SCREEN_TILE_PX - CAMERA.centerY) *
          CAMERA.zoom) / TEXTURE_SCALE.y,
      });
    });
  }

  it("lifts a negative-elevation source downward without losing its exact anchor", () => {
    const stamp = darknessRevealStamp(
      { ...ANCHOR, groundHeight: -1 },
      CAMERA,
      { x: 1, y: 1 },
    );
    expect(stamp).toEqual({
      x: CAMERA.viewportWidth / 2 +
        (ANCHOR.anchorX * SCREEN_TILE_PX - CAMERA.centerX) * CAMERA.zoom,
      y: CAMERA.viewportHeight / 2 +
        (ANCHOR.anchorY * SCREEN_TILE_PX + SCREEN_TILE_PX - CAMERA.centerY) *
        CAMERA.zoom,
    });
  });

  it("keeps an LOS cell tile-centered when it has no exact anchor", () => {
    const tileCell = {
      tileX: ANCHOR.tileX,
      tileY: ANCHOR.tileY,
      strength: ANCHOR.strength,
      groundHeight: ANCHOR.groundHeight,
      brushRadiusTiles: ANCHOR.brushRadiusTiles,
      brushAlpha: ANCHOR.brushAlpha,
    };
    const stamp = darknessRevealStamp(tileCell, CAMERA, { x: 1, y: 1 });
    expect(stamp.x).toBe(
      CAMERA.viewportWidth / 2 +
      ((4.5 * SCREEN_TILE_PX) - CAMERA.centerX) * CAMERA.zoom,
    );
    expect(stamp.y).toBe(
      CAMERA.viewportHeight / 2 +
      ((6.5 * SCREEN_TILE_PX) - 2 * SCREEN_TILE_PX - CAMERA.centerY) *
      CAMERA.zoom,
    );
  });

  it("projects through cosmetic camera rotation exactly once", () => {
    const camera = {
      ...CAMERA,
      centerX: 0,
      centerY: 0,
      rotation: Math.PI / 2,
      zoom: 2,
    };
    const stamp = darknessRevealStamp(
      { ...ANCHOR, anchorX: 1, anchorY: 0, groundHeight: 0 },
      camera,
      { x: 1, y: 1 },
    );

    expect(stamp.x).toBeCloseTo(camera.viewportWidth / 2);
    expect(stamp.y).toBeCloseTo(camera.viewportHeight / 2 + SCREEN_TILE_PX * 2);
  });

  it("counteracts camera zoom and rotation for a viewport-space mask", () => {
    const camera = { ...CAMERA, rotation: Math.PI / 6 };
    const transform = darknessScreenSpaceTransform(camera, TEXTURE_SCALE);
    const origin = {
      x: camera.viewportWidth / 2,
      y: camera.viewportHeight / 2,
    };
    const screenOrigin = applyCameraToMaskOrigin(origin, camera, transform);

    expect(screenOrigin.x).toBeCloseTo(0);
    expect(screenOrigin.y).toBeCloseTo(0);
    expect(transform.scaleX * camera.zoom).toBe(TEXTURE_SCALE.x);
    expect(transform.scaleY * camera.zoom).toBe(TEXTURE_SCALE.y);
  });
});

function applyCameraToMaskOrigin(
  origin: Readonly<{ x: number; y: number }>,
  camera: typeof CAMERA,
  transform: ReturnType<typeof darknessScreenSpaceTransform>,
): { x: number; y: number } {
  const cosine = Math.cos(camera.rotation);
  const sine = Math.sin(camera.rotation);
  const dx = transform.x - origin.x;
  const dy = transform.y - origin.y;
  return {
    x: origin.x + camera.zoom * (cosine * dx - sine * dy),
    y: origin.y + camera.zoom * (sine * dx + cosine * dy),
  };
}
