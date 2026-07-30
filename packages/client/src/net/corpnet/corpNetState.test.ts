import { describe, expect, it } from "vitest";
import { EXPERIMENTAL_CORPNET_TUNING } from "./corpNetTuning.js";
import { CorpNetState } from "./corpNetState.js";

describe("CorpNetState", () => {
  it("holds prediction only after bounded snapshot silence", () => {
    const state = new CorpNetState(true);
    state.reset(0);

    expect(state.shouldHoldPrediction(749)).toBe(false);
    expect(state.shouldHoldPrediction(750)).toBe(true);
  });

  it("reports one hold transition until a fresh snapshot arrives", () => {
    const state = new CorpNetState(true);
    state.reset(0);

    expect(state.predictionGate(749)).toBe("open");
    expect(state.predictionGate(750)).toBe("entered-hold");
    expect(state.predictionGate(751)).toBe("holding");
    state.observeSnapshot(1_000);
    expect(state.predictionGate(1_001)).toBe("open");
  });

  it("requests recovery after a meaningful stall with capped exponential backoff", () => {
    const state = new CorpNetState(true);
    const stallAfter = EXPERIMENTAL_CORPNET_TUNING.stall.recoveryAfterMs;
    const initialBackoff = EXPERIMENTAL_CORPNET_TUNING.stall.initialRecoveryBackoffMs;
    state.reset(0);

    expect(state.watchdog(stallAfter - 1)).toEqual({ stalled: false, requestRecovery: false });
    expect(state.watchdog(stallAfter)).toEqual({ stalled: true, requestRecovery: true });
    expect(state.watchdog(stallAfter + initialBackoff - 1))
      .toEqual({ stalled: true, requestRecovery: false });
    expect(state.watchdog(stallAfter + initialBackoff))
      .toEqual({ stalled: true, requestRecovery: true });
  });

  it("resets the hold and recovery backoff when a snapshot arrives", () => {
    const state = new CorpNetState(true);
    state.reset(0);
    state.watchdog(EXPERIMENTAL_CORPNET_TUNING.stall.recoveryAfterMs);
    state.observeSnapshot(10_000);

    expect(state.shouldHoldPrediction(10_001)).toBe(false);
    expect(state.watchdog(10_001)).toEqual({ stalled: false, requestRecovery: false });
  });

  it("exposes the next absolute watchdog deadline", () => {
    const state = new CorpNetState(true);
    state.reset(1_000);

    expect(state.watchdogDeadlineMs()).toBe(
      1_000 + EXPERIMENTAL_CORPNET_TUNING.stall.recoveryAfterMs,
    );
    state.watchdog(1_000 + EXPERIMENTAL_CORPNET_TUNING.stall.recoveryAfterMs);
    expect(state.watchdogDeadlineMs()).toBe(
      1_000 + EXPERIMENTAL_CORPNET_TUNING.stall.recoveryAfterMs +
        EXPERIMENTAL_CORPNET_TUNING.stall.initialRecoveryBackoffMs,
    );
  });
});
