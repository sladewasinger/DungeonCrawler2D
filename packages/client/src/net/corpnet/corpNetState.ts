import { EXPERIMENTAL_CORPNET_TUNING } from "./corpNetTuning.js";

export interface CorpNetWatchdogState {
  readonly stalled: boolean;
  readonly requestRecovery: boolean;
}

export type CorpNetPredictionGate = "open" | "entered-hold" | "holding";

/** Tracks snapshot silence and bounded recovery backoff for one connection. */
export class CorpNetState {
  private lastSnapshotAtMs: number | null = null;
  private nextRecoveryAtMs = Number.POSITIVE_INFINITY;
  private recoveryBackoffMs: number =
    EXPERIMENTAL_CORPNET_TUNING.stall.initialRecoveryBackoffMs;
  private predictionHoldEntered = false;

  constructor(private enabledValue: boolean) {}

  get enabled(): boolean {
    return this.enabledValue;
  }

  setEnabled(enabled: boolean, nowMs: number): void {
    this.enabledValue = enabled;
    this.reset(nowMs);
  }

  reset(nowMs?: number): void {
    this.lastSnapshotAtMs = nowMs ?? null;
    this.nextRecoveryAtMs = firstRecoveryAt(nowMs);
    this.recoveryBackoffMs = EXPERIMENTAL_CORPNET_TUNING.stall.initialRecoveryBackoffMs;
    this.predictionHoldEntered = false;
  }

  observeSnapshot(nowMs: number): void {
    if (!this.enabledValue) return;
    this.lastSnapshotAtMs = nowMs;
    this.nextRecoveryAtMs = firstRecoveryAt(nowMs);
    this.recoveryBackoffMs = EXPERIMENTAL_CORPNET_TUNING.stall.initialRecoveryBackoffMs;
    this.predictionHoldEntered = false;
  }

  shouldHoldPrediction(nowMs: number): boolean {
    return this.snapshotSilenceMs(nowMs) >=
      EXPERIMENTAL_CORPNET_TUNING.stall.predictionHoldAfterMs;
  }

  predictionGate(nowMs: number): CorpNetPredictionGate {
    if (!this.shouldHoldPrediction(nowMs)) return "open";
    if (this.predictionHoldEntered) return "holding";
    this.predictionHoldEntered = true;
    return "entered-hold";
  }

  watchdogDeadlineMs(): number | null {
    if (!this.enabledValue || this.lastSnapshotAtMs === null) return null;
    return this.nextRecoveryAtMs;
  }

  watchdog(nowMs: number): CorpNetWatchdogState {
    const stalled = this.snapshotSilenceMs(nowMs) >=
      EXPERIMENTAL_CORPNET_TUNING.stall.recoveryAfterMs;
    if (!stalled || nowMs < this.nextRecoveryAtMs) {
      return { stalled, requestRecovery: false };
    }
    this.nextRecoveryAtMs = nowMs + this.recoveryBackoffMs;
    this.recoveryBackoffMs = Math.min(
      EXPERIMENTAL_CORPNET_TUNING.stall.maximumRecoveryBackoffMs,
      this.recoveryBackoffMs * EXPERIMENTAL_CORPNET_TUNING.stall.recoveryBackoffMultiplier,
    );
    return { stalled: true, requestRecovery: true };
  }

  private snapshotSilenceMs(nowMs: number): number {
    if (!this.enabledValue || this.lastSnapshotAtMs === null) return 0;
    return Math.max(0, nowMs - this.lastSnapshotAtMs);
  }
}

function firstRecoveryAt(nowMs: number | undefined): number {
  if (nowMs === undefined) return Number.POSITIVE_INFINITY;
  return nowMs + EXPERIMENTAL_CORPNET_TUNING.stall.recoveryAfterMs;
}
