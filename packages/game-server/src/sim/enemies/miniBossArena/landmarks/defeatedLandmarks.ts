import {
  miniBossArenaKey,
  type DefeatedMiniBossArenaWindow,
} from "@dc2d/engine";
import type { PlayerSlot, SimState } from "../../../state/state.js";
import { chunkAt, compassWindowChunks } from "./nearbyChunks.js";

/** Complete authoritative defeat state for the receiver's bounded compass search. */
export function defeatedMiniBossArenaWindowForSlot(
  sim: SimState,
  slot: PlayerSlot,
): DefeatedMiniBossArenaWindow {
  const center = chunkAt(slot.entity.body);
  return {
    center,
    arenas: compassWindowChunks(center)
      .filter(({ cx, cy }) => sim.defeatedMiniBossArenas.has(miniBossArenaKey({
        floor: sim.world.floor,
        cx,
        cy,
      }))),
  };
}
