import type { PlayerSlot, SimState } from "./state.js";

/** Rebase lifecycle deadlines by offline time so reconnect grace pauses them. */
export function restorePausedLifecycle(sim: SimState, slot: PlayerSlot): void {
  const disconnectedAt = slot.disconnectedAtTick ?? sim.tickCount;
  const pausedTicks = Math.max(0, sim.tickCount - disconnectedAt);
  if (slot.respawnAtTick !== null) slot.respawnAtTick += pausedTicks;
  if (slot.downedAtTick !== null) slot.downedAtTick += pausedTicks;
  if (slot.entity.downedUntil !== undefined) slot.entity.downedUntil += pausedTicks;
  if (slot.spawnGraceUntilTick > disconnectedAt) slot.spawnGraceUntilTick += pausedTicks;
  slot.disconnectedAtTick = null;
}
