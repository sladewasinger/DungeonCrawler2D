import { LEVEL } from "../../core/level.js";
import { World } from "../../core/world.js";
import type { WorldFeatures } from "../../core/worldFeatures.js";
import { finiteWorldFixture } from "../../core/fixtures/finiteWorldFixture.js";
import {
  miniBossArenaForChunk,
  type MiniBossArenaSite,
} from "../miniBossArena/miniBossArena.js";

export function authoredRoomWorldFixture(features?: WorldFeatures): World {
  return new World(0, 0, {
    level: LEVEL.Sandbox,
    ...(features ? { features } : {}),
  });
}

export function finiteFeatureWorldFixture(voidTerrain = true): World {
  return finiteWorldFixture({ voidTerrain });
}

export function finiteMiniBossArenaFixture(): {
  readonly world: World;
  readonly site: MiniBossArenaSite;
} {
  const world = finiteFeatureWorldFixture();
  const arena = world.generatedFloor?.miniBossArenas[0];
  if (!arena) throw new Error("finite feature fixture has no ordinary mini-boss arena");
  const site = miniBossArenaForChunk({
    worldSeed: world.worldSeed,
    floor: world.floor,
    generatedFloor: world.generatedFloor,
    ...arena.chunk,
  });
  if (!site) throw new Error("finite feature fixture arena metadata did not resolve");
  return { world, site };
}
