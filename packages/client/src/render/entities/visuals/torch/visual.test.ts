import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { WORLD_PIXEL_SCALE } from "../../../../boot/assetManifest.js";
import { updateTorchVisual } from "./visual.js";

vi.mock("../../geometry/worldToScreen.js", () => ({
  worldToScreen: (x: number, y: number) => ({ x: x * 20, y: y * 20 }),
  groundToScreen: (x: number, y: number, height: number) => ({
    x: x * 20,
    y: y * 20 - height * 10,
  }),
  depthForEntityNow: (x: number, y: number, lift = 0) => x + y + lift,
}));

vi.mock("../../motion/lift.js", () => ({ spriteLiftPx: (height: number) => height * 10 }));

function spriteProbe() {
  return {
    frame: { name: "" },
    visible: false,
    x: 0,
    y: 0,
    depth: 0,
    angle: 0,
    scale: 0,
    setFrame(name: string) {
      this.frame.name = name;
      return this;
    },
    setPosition(x: number, y: number) {
      this.x = x;
      this.y = y;
      return this;
    },
    setDepth(depth: number) {
      this.depth = depth;
      return this;
    },
    setAngle(angle: number) {
      this.angle = angle;
      return this;
    },
    setScale(scale: number) {
      this.scale = scale;
      return this;
    },
    setVisible(visible: boolean) {
      this.visible = visible;
      return this;
    },
  };
}

describe("updateTorchVisual", () => {
  it("keeps a landed torch visible at its exact, elevated ground anchor", () => {
    const body = spriteProbe();
    updateTorchVisual(
      { kind: "torch", body: body as unknown as Phaser.GameObjects.Sprite },
      {
        id: "torch-1",
        x: 4.25,
        y: 6.75,
        z: 2,
        air: false,
        state: "placed",
        frame: "item_torch",
        vx: 0,
        vy: 0,
      },
      { world: { groundAt: () => 99 } } as never,
    );

    expect(body).toMatchObject({
      frame: { name: "item_torch" },
      visible: true,
      x: 85,
      y: 115,
      angle: 0,
    });
    expect(body.scale).toBeCloseTo(WORLD_PIXEL_SCALE * 0.78);
  });
});
