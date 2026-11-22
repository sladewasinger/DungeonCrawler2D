import { describe, expect, it } from "vitest";
import { RemotePlayerSmoother } from "./remoteInterp.js";
import { createDefaultPlayer } from "./worldPrediction.js";

describe("RemotePlayerSmoother", () => {
  it("smoothly interpolates remote movement and jump height over 60Hz steps and keeps moving true while converging", () => {
    const smoother = new RemotePlayerSmoother();
    const p2Start = { ...createDefaultPlayer("p2"), x: 1, y: 1, jumpZ: 0 };
    smoother.setTargets([createDefaultPlayer("p1"), p2Start], "p1");

    const p2Moved = { ...p2Start, x: 1.5, y: 1.2, jumpZ: 0.4, jumpVz: 2.0, moving: false };
    smoother.setTargets([createDefaultPlayer("p1"), p2Moved], "p1");
    smoother.step(1 / 60);

    const mid = smoother.resolve(p2Moved);
    expect(mid.x).toBeGreaterThan(1);
    expect(mid.x).toBeLessThan(1.5);
    expect(mid.jumpZ).toBeGreaterThan(0);
    expect(mid.jumpZ).toBeLessThan(0.4);
    expect(mid.moving).toBe(true);
  });

  it("snaps immediately on large teleport gaps and prunes disconnected players", () => {
    const smoother = new RemotePlayerSmoother();
    const p2 = { ...createDefaultPlayer("p2"), x: 1, y: 1 };
    smoother.setTargets([p2], "p1");

    const p2Far = { ...p2, x: 10, y: 1 };
    smoother.setTargets([p2Far], "p1");
    expect(smoother.resolve(p2Far).x).toBe(10);

    smoother.setTargets([], "p1");
    expect(smoother.resolve({ ...p2, x: 2 })).toEqual({ ...p2, x: 2 });
  });
});
