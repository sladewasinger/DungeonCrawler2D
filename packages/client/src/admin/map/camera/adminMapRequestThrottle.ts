import type { AdminMapCenter } from "../adminMapCamera.js";

export interface AdminMapRequest {
  readonly level: "dungeon" | "sandbox";
  readonly floor: number;
  readonly center: AdminMapCenter;
  readonly radius: number;
}

export interface AdminMapRequestThrottleOptions {
  readonly send: (request: AdminMapRequest) => void;
  readonly now?: () => number;
  readonly minimumIntervalMs?: number;
}

const DEFAULT_MINIMUM_INTERVAL_MS = 250;

/** Coalesces local camera movement into a bounded stream of server map reads. */
export class AdminMapRequestThrottle {
  private readonly now: () => number;
  private readonly minimumIntervalMs: number;
  private lastSentAt = Number.NEGATIVE_INFINITY;
  private pending: AdminMapRequest | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: AdminMapRequestThrottleOptions) {
    this.now = options.now ?? Date.now;
    this.minimumIntervalMs = options.minimumIntervalMs ?? DEFAULT_MINIMUM_INTERVAL_MS;
  }

  request(request: AdminMapRequest): void {
    if (this.canSendNow()) return this.send(request);
    this.pending = request;
    this.schedulePendingRequest();
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
  }

  private canSendNow(): boolean {
    return this.now() - this.lastSentAt >= this.minimumIntervalMs && !this.timer;
  }

  private send(request: AdminMapRequest): void {
    this.lastSentAt = this.now();
    this.options.send(request);
  }

  private schedulePendingRequest(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => this.flushPendingRequest(), this.remainingDelay());
  }

  private flushPendingRequest(): void {
    this.timer = null;
    const request = this.pending;
    this.pending = null;
    if (request) this.send(request);
  }

  private remainingDelay(): number {
    return Math.max(0, this.minimumIntervalMs - (this.now() - this.lastSentAt));
  }
}
