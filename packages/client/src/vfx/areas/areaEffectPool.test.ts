// Pool-level area-rig lifecycle coverage verifies same-id reuse and effect replacement.
import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { AreaEffectPool, type AreaEffectRig, type AreaTileView } from "./areaEffectPool.js";

vi.mock("phaser", () => ({ default: { BlendModes: { MULTIPLY: 0 } } }));

const tile = (effectId: string): AreaTileView => ({
  id: "4,7",
  effectId,
  x: 4.5,
  y: 7.5,
  sprite: "smoke",
});

describe("AreaEffectPool", () => {
  it("reuses an unchanged rig and destroys it exactly once when the effect changes", () => {
    const rigs: AreaEffectRig[] = [];
    const factory = vi.fn((view: AreaTileView): AreaEffectRig => {
      const rig = { sprite: view.sprite, effectId: view.effectId, light: null, destroy: vi.fn() };
      rigs.push(rig);
      return rig;
    });
    const pool = new AreaEffectPool({} as Phaser.Scene, factory);

    pool.sync([tile("area-smoke-a")]);
    pool.sync([tile("area-smoke-a")]);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(rigs[0]?.destroy).not.toHaveBeenCalled();

    pool.sync([tile("area-smoke-b")]);
    expect(factory).toHaveBeenCalledTimes(2);
    expect(rigs[0]?.destroy).toHaveBeenCalledTimes(1);
    expect(rigs[1]?.destroy).not.toHaveBeenCalled();
  });

  it("reuses its seen and light output collections across sustained frames", () => {
    const light = { id: "4,7", x: 4.5, y: 7.5, color: 0, radiusTiles: 1, kind: "fire" as const, seed: 1 };
    const factory = (): AreaEffectRig => ({
      sprite: "fire",
      effectId: "area-fire",
      light,
      destroy: vi.fn(),
    });
    const pool = new AreaEffectPool({} as Phaser.Scene, factory);
    const view = { ...tile("area-fire"), sprite: "fire" as const };
    const output = pool.sync([view]);

    for (let frame = 0; frame < 1_000; frame++) {
      expect(pool.sync(frame % 2 === 0 ? [view] : [])).toBe(output);
    }
  });
});
