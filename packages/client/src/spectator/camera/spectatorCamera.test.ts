import { describe, expect, it } from "vitest";
import { smoothSpectatorCamera } from "./spectatorCamera.js";

describe("spectator camera smoothing", () => {
  it("eases toward a delayed target without snapping or overshooting", () => {
    const center = smoothSpectatorCamera({ x: 0, y: 0 }, { x: 100, y: -50 }, 16);
    expect(center.x).toBeGreaterThan(0);
    expect(center.x).toBeLessThan(100);
    expect(center.y).toBeLessThan(0);
    expect(center.y).toBeGreaterThan(-50);
  });

  it("keeps its position when a render frame has no elapsed time", () => {
    expect(smoothSpectatorCamera({ x: 4, y: 8 }, { x: 20, y: 30 }, 0))
      .toEqual({ x: 4, y: 8 });
  });
});
