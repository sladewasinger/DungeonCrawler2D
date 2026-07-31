import { describe, expect, it } from "vitest";
import { nextSpectatorCameraZoom } from "./spectatorCameraZoom.js";

describe("spectator camera zoom", () => {
  it("zooms in and out by a quarter step", () => {
    expect(nextSpectatorCameraZoom(1.25, "in")).toBe(1.5);
    expect(nextSpectatorCameraZoom(1.25, "out")).toBe(1);
  });

  it("stays within a useful live-view range", () => {
    expect(nextSpectatorCameraZoom(0.5, "out")).toBe(0.5);
    expect(nextSpectatorCameraZoom(2.5, "in")).toBe(2.5);
  });
});
