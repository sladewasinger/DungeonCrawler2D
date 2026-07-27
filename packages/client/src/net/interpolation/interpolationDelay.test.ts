import { describe, expect, it } from "vitest";
import {
  InterpolationDelay,
  MAX_INTERPOLATION_DELAY_MS,
  MIN_INTERPOLATION_DELAY_MS,
} from "./interpolationDelay.js";

describe("InterpolationDelay", () => {
  it("uses a low stable-link delay for active 20 Hz snapshots", () => {
    const delay = new InterpolationDelay();

    for (let tick = 100; tick <= 110; tick++) {
      delay.observe(tick, (tick - 100) * 50);
    }

    expect(delay.currentMs).toBe(MIN_INTERPOLATION_DELAY_MS);
  });

  it("does not mistake intentional snapshot cadence changes for network jitter", () => {
    const delay = new InterpolationDelay();
    delay.observe(100, 0);
    delay.observe(102, 100);
    delay.observe(103, 150);
    delay.observe(105, 250);

    expect(delay.currentMs).toBe(MIN_INTERPOLATION_DELAY_MS);
  });

  it("adds bounded history quickly during irregular packet arrival and decays it gradually", () => {
    const delay = new InterpolationDelay();
    delay.observe(100, 0);
    const expanded = delay.observe(101, 90);
    const recovering = delay.observe(102, 140);

    expect(expanded).toBe(115);
    expect(recovering).toBeGreaterThan(MIN_INTERPOLATION_DELAY_MS);
    expect(recovering).toBeLessThan(expanded);
  });

  it("caps extreme jitter and resets after a server timeline restart", () => {
    const delay = new InterpolationDelay();
    delay.observe(100, 0);
    delay.observe(101, 1000);

    expect(delay.currentMs).toBe(MAX_INTERPOLATION_DELAY_MS);

    delay.observe(1, 1100);

    expect(delay.currentMs).toBe(MIN_INTERPOLATION_DELAY_MS);
  });
});
