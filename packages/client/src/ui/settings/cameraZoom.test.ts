import { describe, expect, it } from "vitest";
import {
  BASE_CAMERA_ZOOM, CAMERA_ZOOM_STOPS, formatRelativeZoom, sanitizeCameraZoom, stepCameraZoom, toRelativeZoom,
} from "./cameraZoom.js";

describe("cameraZoom", () => {
  it("anchors 4x internal scale as 1.0x user-facing relative zoom", () => {
    expect(BASE_CAMERA_ZOOM).toBe(4.0);
    expect(toRelativeZoom(4.0)).toBe(1.0);
    expect(formatRelativeZoom(2.0)).toBe("0.5×");
    expect(formatRelativeZoom(3.0)).toBe("0.75×");
    expect(formatRelativeZoom(4.0)).toBe("1.0×");
    expect(formatRelativeZoom(5.0)).toBe("1.25×");
    expect(formatRelativeZoom(6.0)).toBe("1.5×");
    expect(formatRelativeZoom(8.0)).toBe("2.0×");
  });

  it("sanitizes invalid zoom values to default and steps cleanly across stops", () => {
    expect(sanitizeCameraZoom(undefined)).toBe(4.0);
    expect(sanitizeCameraZoom(Number.NaN)).toBe(4.0);
    expect(sanitizeCameraZoom(100)).toBe(CAMERA_ZOOM_STOPS[CAMERA_ZOOM_STOPS.length - 1]);
    expect(sanitizeCameraZoom(0.2)).toBe(CAMERA_ZOOM_STOPS[0]);

    let z = BASE_CAMERA_ZOOM;
    z = stepCameraZoom(z, 1.2);
    expect(z).toBe(5.0);
    z = stepCameraZoom(z, 1.2);
    expect(z).toBe(6.0);
    z = stepCameraZoom(z, 0.8);
    expect(z).toBe(5.0);
    z = stepCameraZoom(z, 0.8);
    expect(z).toBe(4.0);
    z = stepCameraZoom(z, 0.8);
    expect(z).toBe(3.0);
    z = stepCameraZoom(z, 0.8);
    expect(z).toBe(2.0);
    expect(stepCameraZoom(z, 0.8)).toBe(2.0);
  });
});
