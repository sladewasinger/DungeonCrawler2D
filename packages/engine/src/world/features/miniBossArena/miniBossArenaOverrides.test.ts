import { describe, expect, it } from "vitest";
import { FEATURE_FACE, TILE } from "../../core/types.js";
import { World } from "../../core/world.js";
import {
  miniBossArenaAtGate,
  miniBossArenaAtPosition,
  miniBossArenaIsStamped,
  type MiniBossArenaSite,
} from "./miniBossArena.js";
import { finiteMiniBossArenaFixture } from "../fixtures/featureWorldFixture.js";

describe("mini-boss arena runtime feature overrides", () => {
  it("retains generated arena identity while a gate is open", () => {
    const { world, arena } = findArena();
    const gate = arena.gates[0];
    if (!gate) throw new Error("arena has no gate");

    world.replaceFeatureOverrides([{
      x: gate.x,
      y: gate.y,
      tile: TILE.Floor,
      featureFace: FEATURE_FACE.Top,
      featureHeight: 0,
    }]);

    expect(miniBossArenaIsStamped(world, arena)).toBe(true);
    expect(miniBossArenaAtPosition(
      world,
      arena.center.x + 0.5,
      arena.center.y + 0.5,
    )?.key).toBe(arena.key);
    expect(miniBossArenaAtGate(world, gate.x, gate.y)).toBeNull();
  });
});

function findArena(): { readonly world: World; readonly arena: MiniBossArenaSite } {
  const { world, site } = finiteMiniBossArenaFixture();
  return { world, arena: site };
}
