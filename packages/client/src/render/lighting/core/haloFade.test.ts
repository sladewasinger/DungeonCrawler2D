/** Locks the short additive-light fade curve without constructing Phaser sprites. */
import { describe, expect, it } from "vitest";
import { TORCH_HALO_FADE_IN_MS, torchHaloFade } from "./haloFade.js";

describe("torchHaloFade", () => {
  it("eases from dark to full strength over the fade window", () => {
    expect(torchHaloFade(100, 100)).toBe(0);
    expect(torchHaloFade(100 + TORCH_HALO_FADE_IN_MS / 2, 100)).toBeCloseTo(0.75);
    expect(torchHaloFade(100 + TORCH_HALO_FADE_IN_MS, 100)).toBe(1);
  });
});
