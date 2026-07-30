import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import type { AnimatedAreaRig } from "./areaAnimatedRig.js";
import { AreaAnimatedPool } from "./areaAnimatedPool.js";
import type { AreaTileView } from "../areaEffectPool.js";
import { areaVisualBudgetFor } from "../presentation/areaVisualBudget.js";
import type { AmbientAreaKind } from "./areaAnimatedRig.js";

const tile = (id: string, sprite: AreaTileView["sprite"]): AreaTileView => ({
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
  it("leaves poison presentation to puddles and bubbles", () => {
    const built: AnimatedAreaRig[] = [];
    const factory = (kind: AmbientAreaKind) => {
      const next = rig(kind);
      built.push(next);
      return next;
    };
    const pool = new AreaAnimatedPool(
      {} as Phaser.Scene,
      areaVisualBudgetFor(true, false),
      factory,
    );

    expect(pool.sync([tile("a", "poison"), tile("b", "poison")]))
      .toHaveLength(0);
    expect(built).toHaveLength(0);
  });

  it("keeps steam lights in the returned accent lights", () => {
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

    const lights = pool.sync([tile("steam-tile", "steam")]);

    expect(lights).toEqual([built[0]?.light]);
  });

  it("releases a steam rig when its tile becomes poison", () => {
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
    expect(built.map(({ kind }) => kind)).toEqual(["steam"]);
    expect(built[0]?.deactivate).toHaveBeenCalledTimes(1);
  });

  it("keeps an unchanged active steam rig running", () => {
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

    pool.sync([tile("steady", "steam")]);
    pool.sync([tile("steady", "steam")]);

    expect(built).toHaveLength(1);
    expect(built[0]?.activate).toHaveBeenCalledTimes(2);
    expect(built[0]?.deactivate).not.toHaveBeenCalled();
  });
});
