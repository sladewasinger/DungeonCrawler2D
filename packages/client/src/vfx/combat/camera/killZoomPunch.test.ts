import { describe, expect, it, vi } from "vitest";
import { HIT_STOP_DURATION_MS, HIT_STOP_ZOOM } from "./hitStop.js";
import { KillZoomPunch, killPunchMultiplier } from "./killZoomPunch.js";

describe("KillZoomPunch", () => {
  it("emits a transient multiplier instead of capturing a resting camera zoom", () => {
    const setMultiplier = vi.fn();
    const punch = new KillZoomPunch(setMultiplier);

    punch.trigger(100);
    punch.update(100 + HIT_STOP_DURATION_MS / 2);
    punch.update(100 + HIT_STOP_DURATION_MS);

    expect(setMultiplier).toHaveBeenNthCalledWith(1, 1);
    expect(setMultiplier).toHaveBeenNthCalledWith(2, HIT_STOP_ZOOM);
    expect(setMultiplier).toHaveBeenNthCalledWith(3, 1);
  });

  it("restarts cleanly for a later kill", () => {
    expect(killPunchMultiplier(HIT_STOP_DURATION_MS / 2)).toBe(HIT_STOP_ZOOM);
    expect(killPunchMultiplier(HIT_STOP_DURATION_MS)).toBe(1);
  });
});
