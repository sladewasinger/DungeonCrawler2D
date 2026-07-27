import { REVIVE_HOLD_TICKS, type EntitySnapshot } from "@dc2d/engine";
import type { SimState } from "../state.js";

/** Public, AOI-scoped progress for a downed player's active revive attempt. */
export function reviveSnapshotFields(
  sim: SimState,
  entityId: string,
): Pick<EntitySnapshot, "reviveProgress"> {
  const attempt = [...sim.reviveAttempts.values()].find((candidate) => candidate.targetId === entityId);
  if (!attempt) return {};
  return {
    reviveProgress: Math.min(1, (sim.tickCount - attempt.startedAtTick) / REVIVE_HOLD_TICKS),
  };
}
