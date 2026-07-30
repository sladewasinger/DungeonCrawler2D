import {
  CORPNET_INPUT_LEASE_TICKS,
  TICK_RATE,
} from "@dc2d/engine";

const CORPNET_INPUT_LEASE_MS = CORPNET_INPUT_LEASE_TICKS * 1_000 / TICK_RATE;

/**
 * Bounded settings for the opt-in Experimental CorpNet path. These values
 * deliberately favor continuity over immediacy on inspected enterprise links.
 */
export const EXPERIMENTAL_CORPNET_TUNING = {
  interpolation: {
    minDelayMs: 150,
    maxDelayMs: 380,
    jitterMarginMultiplier: 3,
  },
  snapshots: {
    maximumQueuedMessages: 6,
    flushDelayMs: 16,
  },
  stall: {
    watchdogIntervalMs: 1_000,
    predictionHoldAfterMs: CORPNET_INPUT_LEASE_MS,
    recoveryAfterMs: 2_500,
    initialRecoveryBackoffMs: 3_000,
    maximumRecoveryBackoffMs: 30_000,
    recoveryBackoffMultiplier: 2,
  },
} as const;
