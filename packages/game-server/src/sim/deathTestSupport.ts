import {
  DOWNED_DURATION,
  RESPAWN_DELAY_TICKS,
  TICK_RATE,
} from "@dc2d/engine";
import { resolveDeaths } from "./deaths.js";
import type { PlayerSlot, SimState } from "./state.js";

export const DOWNED_DURATION_TICKS = DOWNED_DURATION * TICK_RATE;
export const DEATH_TO_RESPAWN_TICKS =
  DOWNED_DURATION_TICKS + RESPAWN_DELAY_TICKS;

export function downAndResolveDeath(
  sim: SimState,
  slot: PlayerSlot,
): void {
  slot.entity.hp = 0;
  resolveDeaths(sim);
  if (slot.entity.downedUntil === undefined) {
    throw new Error("player did not enter the downed state");
  }
  sim.tickCount = slot.entity.downedUntil;
  resolveDeaths(sim);
}
