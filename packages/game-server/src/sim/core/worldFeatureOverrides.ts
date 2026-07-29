import type { SimState } from "../state/state.js";
import { miniBossArenaGateOverrides } from "../enemies/miniBossArena/gateOverrides.js";
import { safeRoomDoorOverrides } from "./safeRoomDoors.js";

/** Refreshes every server-owned runtime feature overlay as one atomic set. */
export function syncWorldFeatureOverrides(sim: SimState): void {
  sim.world.replaceFeatureOverrides([
    ...safeRoomDoorOverrides(sim),
    ...miniBossArenaGateOverrides(sim),
  ]);
}
