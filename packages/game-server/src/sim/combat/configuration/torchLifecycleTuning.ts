import { TICK_RATE } from "@dc2d/engine";
import torchLifecycleTuning from "./torchLifecycleTuning.json" with { type: "json" };

interface TorchLifecycleTuning {
  readonly activeFireBurnSeconds: number;
}

/** Authoritative burn timing for a torch placed directly on an active fire cell. */
export const TORCH_LIFECYCLE_TUNING: TorchLifecycleTuning = validateTorchLifecycleTuning(
  torchLifecycleTuning,
);

export const ACTIVE_FIRE_TORCH_BURN_TICKS = Math.ceil(
  TORCH_LIFECYCLE_TUNING.activeFireBurnSeconds * TICK_RATE,
);

function validateTorchLifecycleTuning(
  tuning: TorchLifecycleTuning,
): TorchLifecycleTuning {
  if (!Number.isFinite(tuning.activeFireBurnSeconds) ||
      tuning.activeFireBurnSeconds <= 0) {
    throw new Error("Torch activeFireBurnSeconds must be positive");
  }
  return Object.freeze({ ...tuning });
}
