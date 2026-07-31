import { TICK_RATE } from "@dc2d/engine";
import rescueTuning from "./rescueTuning.json" with { type: "json" };

interface RescueTuning {
  readonly cooldownSeconds: number;
  readonly destinationSearchRadiusTiles: number;
  readonly destinationMinimumDistanceTiles: number;
}

/** Developer-facing controls for the production stuck-player rescue action. */
export const RESCUE_TUNING: RescueTuning = validateTuning(rescueTuning);

export const RESCUE_COOLDOWN_TICKS = Math.ceil(
  RESCUE_TUNING.cooldownSeconds * TICK_RATE,
);

function validateTuning(tuning: RescueTuning): RescueTuning {
  if (!Number.isFinite(tuning.cooldownSeconds) || tuning.cooldownSeconds <= 0) {
    throw new Error("Rescue cooldownSeconds must be positive");
  }
  if (!Number.isInteger(tuning.destinationSearchRadiusTiles) ||
      tuning.destinationSearchRadiusTiles < 1) {
    throw new Error("Rescue destinationSearchRadiusTiles must be a positive integer");
  }
  if (!Number.isFinite(tuning.destinationMinimumDistanceTiles) ||
      tuning.destinationMinimumDistanceTiles < 0 ||
      tuning.destinationMinimumDistanceTiles >=
        tuning.destinationSearchRadiusTiles) {
    throw new Error("Rescue destinationMinimumDistanceTiles must be within the search radius");
  }
  return Object.freeze({ ...tuning });
}
