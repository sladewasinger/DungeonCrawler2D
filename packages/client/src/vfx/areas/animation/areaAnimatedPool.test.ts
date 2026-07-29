import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import type { AnimatedAreaRig } from "./areaAnimatedRig.js";
import { AreaAnimatedPool } from "./areaAnimatedPool.js";
import type { AreaTileView } from "../areaEffectPool.js";
import { areaVisualBudgetFor } from "../presentation/areaVisualBudget.js";
import type { AmbientAreaKind } from "./areaAnimatedRig.js";

const tile = (id: string, sprite: AmbientAreaKind): AreaTileView => ({
  id,
  effectId: `area-${sprite}`,
  x: 0.5,
  y: 0.5,
  groundHeight: 0,
  screenX: 0,
  screenY: 0,
  sprite,
  neighborMask: 0,
});

function rig(kind: AmbientAreaKind): AnimatedAreaRig {
  return {
    kind,
    light: { id: kind, x: 0, y: 0, color: 0, radiusTiles: 1, kind, seed: 1 },
    activate: vi.fn(),
    deactivate: vi.fn(),
    destroy: vi.fn(),
  };
}

describe("AreaAnimatedPool", () => {
  it("reuses released rigs while capping poison light count", () => {
    const built: AnimatedAreaRig[] = [];
    const factory = (kind: AmbientAreaKind) => {
      const next = rig(kind);
      built.push(next);
      return next;
    };
    const pool = new AreaAnimatedPool(
      {} as Phaser.Scene,
      { ...areaVisualBudgetFor(true, false), maximumPoisonRigs: 1 },
      factory,
    );

    expect(pool.sync([tile("a", "poison"), tile("b", "poison")]))
      .toHaveLength(1);
    pool.sync([]);
    expect(built[0]?.deactivate).toHaveBeenCalledTimes(1);
    pool.sync([tile("c", "poison")]);
    expect(built).toHaveLength(1);
    expect(built[0]?.activate).toHaveBeenCalledTimes(2);
  });

  it("replaces an active rig when a tile changes animated material", () => {
    const built: AnimatedAreaRig[] = [];
    const pool = new AreaAnimatedPool(
      {} as Phaser.Scene,
      areaVisualBudgetFor(false, false),
      (kind) => {
        const next = rig(kind);
        built.push(next);
        return next;
      },
    );
    pool.sync([tile("same", "steam")]);
    pool.sync([tile("same", "poison")]);
    expect(built.map(({ kind }) => kind)).toEqual(["steam", "poison"]);
    expect(built[0]?.deactivate).toHaveBeenCalledTimes(1);
  });

  it("keeps an unchanged active poison rig running", () => {
    const built: AnimatedAreaRig[] = [];
    const pool = new AreaAnimatedPool(
      {} as Phaser.Scene,
      areaVisualBudgetFor(false, false),
      (kind) => {
        const next = rig(kind);
        built.push(next);
        return next;
      },
    );

    pool.sync([tile("steady", "poison")]);
    pool.sync([tile("steady", "poison")]);

    expect(built).toHaveLength(1);
    expect(built[0]?.activate).toHaveBeenCalledTimes(2);
    expect(built[0]?.deactivate).not.toHaveBeenCalled();
  });
});
