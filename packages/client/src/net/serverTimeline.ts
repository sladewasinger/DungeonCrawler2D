import { TICK_RATE } from "@dc2d/engine";

const TICK_MS = 1000 / TICK_RATE;
const PHASE_CORRECTION = 0.1;
const MAX_PHASE_CORRECTION_MS = 5;
const DISCONTINUITY_MS = 500;

export class ServerTimeline {
  private serverTimeMs: number | null = null;
  private localTimeMs: number | null = null;
  private lastTick: number | null = null;

  reset(): void {
    this.serverTimeMs = null;
    this.localTimeMs = null;
    this.lastTick = null;
  }

  observe(serverTick: number, localTimeMs: number): number {
    const observedServerTime = serverTick * TICK_MS;
    if (this.serverTimeMs === null || this.localTimeMs === null ||
      this.lastTick === null || serverTick <= this.lastTick) {
      return this.anchor(serverTick, observedServerTime, localTimeMs);
    }
    const estimatedServerTime = this.now(localTimeMs);
    const error = observedServerTime - estimatedServerTime;
    if (Math.abs(error) >= DISCONTINUITY_MS) {
      return this.anchor(serverTick, observedServerTime, localTimeMs);
    }
    const correction = Math.max(
      -MAX_PHASE_CORRECTION_MS,
      Math.min(MAX_PHASE_CORRECTION_MS, error * PHASE_CORRECTION),
    );
    this.serverTimeMs = estimatedServerTime + correction;
    this.localTimeMs = localTimeMs;
    this.lastTick = serverTick;
    return observedServerTime;
  }

  now(localTimeMs: number): number {
    if (this.serverTimeMs === null || this.localTimeMs === null) return localTimeMs;
    return this.serverTimeMs + Math.max(0, localTimeMs - this.localTimeMs);
  }

  private anchor(
    serverTick: number,
    serverTimeMs: number,
    localTimeMs: number,
  ): number {
    this.serverTimeMs = serverTimeMs;
    this.localTimeMs = localTimeMs;
    this.lastTick = serverTick;
    return serverTimeMs;
  }
}
