import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { HIT_STOP_DURATION_MS, HIT_STOP_ZOOM } from "../hitStop.js";
import { KillZoomPunch } from "./killZoomPunch.js";

describe("KillZoomPunch", () => {
  it("anchors repeated punches and recovery to the original resting zoom", () => {
    const zoomTo = vi.fn();
    const camera = { zoom: 1.25, zoomTo };
    const punch = new KillZoomPunch(camera as unknown as Phaser.Cameras.Scene2D.Camera);

    punch.trigger();
    camera.zoom = 1.25 * HIT_STOP_ZOOM;
    punch.trigger();

    const halfDuration = HIT_STOP_DURATION_MS / 2;
    expect(zoomTo).toHaveBeenNthCalledWith(
      1, 1.25 * HIT_STOP_ZOOM, halfDuration, "Sine.easeOut", true, expect.any(Function),
    );
    expect(zoomTo).toHaveBeenNthCalledWith(
      2, 1.25 * HIT_STOP_ZOOM, halfDuration, "Sine.easeOut", true, expect.any(Function),
    );
    const staleCompletion = zoomTo.mock.calls[0]?.[4] as ((camera: unknown, progress: number) => void);
    staleCompletion(camera, 1);
    expect(zoomTo).toHaveBeenCalledTimes(2);
    const complete = zoomTo.mock.calls[1]?.[4] as ((camera: unknown, progress: number) => void);
    complete(camera, 1);
    expect(zoomTo).toHaveBeenNthCalledWith(
      3, 1.25, halfDuration, "Sine.easeIn",
    );
  });
});
