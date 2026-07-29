import {
  miniBossArenaForChunk,
  miniBossArenaIsStamped,
  type MiniBossArenaSite,
} from "@dc2d/engine";
import type { SimState } from "../../../state/state.js";

export function findArena(sim: SimState): MiniBossArenaSite {
  for (let cy = -10; cy <= 10; cy++) {
    for (let cx = -10; cx <= 10; cx++) {
      const arena = miniBossArenaForChunk({
        worldSeed: sim.world.worldSeed,
        floor: sim.world.floor,
        cx,
        cy,
      });
      if (arena && miniBossArenaIsStamped(sim.world, arena)) return arena;
    }
  }
  throw new Error("test seed produced no mini-boss arena");
}
