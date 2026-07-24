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
});
