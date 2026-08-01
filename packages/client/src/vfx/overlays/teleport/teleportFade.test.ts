import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { TeleportFade } from "./teleportFade.js";

describe("TeleportFade", () => {
  it("sizes its HUD-scene overlay to the full physical canvas on resize", () => {
    const setSize = vi.fn();
    const overlay = {
      setOrigin: () => overlay,
      setScrollFactor: () => overlay,
      setAlpha: () => overlay,
      setDepth: () => overlay,
      setSize,
      destroy: vi.fn(),
    };
    const scene = {
      scale: { width: 640, height: 360 },
      add: { rectangle: vi.fn(() => overlay) },
    };
    const fade = new TeleportFade(scene as unknown as Phaser.Scene);

    fade.resize(900, 1200);

    expect(setSize).toHaveBeenCalledWith(900, 1200);
  });
});
