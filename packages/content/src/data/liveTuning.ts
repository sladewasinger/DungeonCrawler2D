/** Materializes effect definitions from the single validated live-tuning source. */
import type { LiveTuning } from "./liveTuning.schema.js";

export function tunedBandageStatus(tuning: LiveTuning) {
  const bandage = tuning.bandage;
  const immediate = [
    { primitive: "modify_health", amount: bandage.immediateHeal },
    { primitive: "remove_status", tag: "bleed" },
  ] as const;
  return {
    ...bandage.status,
    duration: bandage.durationSeconds,
    tickEvery: bandage.tickEverySeconds,
    onApply: immediate,
    onRefresh: immediate,
    onTick: [
      { primitive: "modify_health", amount: bandage.healPerTick },
    ] as const,
  };
}
