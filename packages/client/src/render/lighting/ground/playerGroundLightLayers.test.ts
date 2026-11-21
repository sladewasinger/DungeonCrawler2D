import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import type { PlayerGroundLightCell } from "./playerGroundLight.js";
import { PlayerGroundLightLayerPool } from "./playerGroundLightLayers.js";

vi.mock("phaser", () => ({ default: { BlendModes: { ADD: 1 } } }));

class FakeGraphics {
  destroyed = false;
  visible = false;

  setBlendMode(): this { return this; }
  setDepth(): this { return this; }
  setVisible(visible: boolean): this { this.visible = visible; return this; }
  clear(): this { return this; }
  fillStyle(): this { return this; }
  fillRect(): this { return this; }
  destroy(): void { this.destroyed = true; }
}

function cell(tileX: number, tileY: number): PlayerGroundLightCell {
  return { tileX, tileY, strength: 1, groundHeight: 0 };
}

describe("PlayerGroundLightLayerPool", () => {
  it("batches cells by depth while retaining the configured cell budget", () => {
    const graphics: FakeGraphics[] = [];
    const scene = {
      add: {
        graphics: () => {
          const layer = new FakeGraphics();
          graphics.push(layer);
          return layer;
        },
      },
    } as unknown as Phaser.Scene;
    const pool = new PlayerGroundLightLayerPool(scene);

    pool.sync([cell(0, 0), cell(1, 0), cell(0, 1)], 0);

    expect(pool.activeCount()).toBe(3);
    expect(graphics).toHaveLength(2);
    pool.dispose();
    expect(graphics.every((layer) => layer.destroyed)).toBe(true);
  });
});
