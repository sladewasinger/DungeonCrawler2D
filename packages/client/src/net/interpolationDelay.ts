import { TICK_RATE } from "@dc2d/engine";

const TICK_MS = 1000 / TICK_RATE;
export const MIN_INTERPOLATION_DELAY_MS = 75;
export const MAX_INTERPOLATION_DELAY_MS = 160;
const JITTER_MARGIN_MULTIPLIER = 2;
const JITTER_RISE_RATE = 0.5;
const JITTER_FALL_RATE = 0.1;

/**
 * Keeps remote presentation close to the server on stable links while retaining
 * more snapshot history when arrival timing becomes irregular.
 */
export class InterpolationDelay {
  private lastServerTick: number | null = null;
  private lastArrivalMs: number | null = null;
  private jitterMs = 0;

  get currentMs(): number {
    return Math.min(
      MAX_INTERPOLATION_DELAY_MS,
      MIN_INTERPOLATION_DELAY_MS + this.jitterMs * JITTER_MARGIN_MULTIPLIER,
    );
  }

  reset(): void {
    this.lastServerTick = null;
    this.lastArrivalMs = null;
    this.jitterMs = 0;
  }

  observe(serverTick: number, arrivalMs: number): number {
    if (this.lastServerTick === null || this.lastArrivalMs === null ||
      serverTick <= this.lastServerTick || arrivalMs < this.lastArrivalMs) {
      this.anchor(serverTick, arrivalMs);
      return this.currentMs;
    }

    const expectedMs = (serverTick - this.lastServerTick) * TICK_MS;
    const actualMs = arrivalMs - this.lastArrivalMs;
    const variationMs = Math.abs(actualMs - expectedMs);
    const rate = variationMs > this.jitterMs
      ? JITTER_RISE_RATE
      : JITTER_FALL_RATE;
    this.jitterMs += (variationMs - this.jitterMs) * rate;
    this.lastServerTick = serverTick;
    this.lastArrivalMs = arrivalMs;
    return this.currentMs;
  }

  private anchor(serverTick: number, arrivalMs: number): void {
    this.lastServerTick = serverTick;
    this.lastArrivalMs = arrivalMs;
    this.jitterMs = 0;
  }
}
