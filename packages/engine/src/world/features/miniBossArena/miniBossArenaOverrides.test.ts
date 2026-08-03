import { describe, expect, it } from "vitest";
import { hashString } from "../../../core/rng.js";
import { FEATURE_FACE, TILE } from "../../core/types.js";
import { World } from "../../core/world.js";
import {
  miniBossArenaAtGate,
  miniBossArenaAtPosition,
  miniBossArenaForChunk,
  miniBossArenaIsStamped,
  type MiniBossArenaSite,
} from "./miniBossArena.js";

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
  const world = new World(hashString("mini-boss-runtime-override"), 1);
  for (let cy = -10; cy <= 10; cy++) {
    for (let cx = -10; cx <= 10; cx++) {
      const arena = miniBossArenaForChunk({
        worldSeed: world.worldSeed,
        floor: world.floor,
        generatedFloor: world.generatedFloor,
        cx,
        cy,
      });
      if (arena && miniBossArenaIsStamped(world, arena)) return { world, arena };
    }
  }
  throw new Error("test seed produced no mini-boss arena");
}
