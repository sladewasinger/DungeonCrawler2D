import { describe, expect, it, vi } from "vitest";
import type Phaser from "phaser";
import { TerrainCameraBackground } from "./cameraBackground.js";

const VIEW = { x: 0, y: 0, width: 320, height: 180 };

describe("TerrainCameraBackground", () => {
  it("uses a presentation override on the first frame", () => {
    const setBackgroundColor = vi.fn();
    const background = new TerrainCameraBackground({
      setBackgroundColor,
    } as unknown as Phaser.Cameras.Scene2D.Camera);

    background.sync(VIEW, 0, "#000000");

    expect(setBackgroundColor).toHaveBeenCalledOnce();
    expect(setBackgroundColor).toHaveBeenCalledWith("#000000");
  });

  it("restores the terrain background when the override is removed", () => {
    const setBackgroundColor = vi.fn();
    const background = new TerrainCameraBackground({
      setBackgroundColor,
    } as unknown as Phaser.Cameras.Scene2D.Camera);

    background.sync(VIEW, 0, "#000000");
    background.sync(VIEW, 0);

    expect(setBackgroundColor).toHaveBeenCalledTimes(2);
    expect(setBackgroundColor.mock.calls[1]?.[0]).not.toBe("#000000");
  });
});
