const AUTH_FAILURE_WINDOW_MS = 10 * 60_000;
const COMMAND_WINDOW_MS = 10_000;
const RESUME_WINDOW_MS = 10_000;
const MAX_AUTH_FAILURES = 3;
const MAX_COMMANDS = 40;
const MAX_SESSION_RESUMES = 8;
const MAX_TRACKED_PEERS = 10_000;

export interface AdminAccessLimiterOptions {
  readonly now?: () => number;
  readonly maxTrackedPeers?: number;
}

/** Shared process-local limits keyed by peer address, not WebSocket lifetime. */
export class AdminAccessLimiter {
  private readonly authFailures = new Map<string, number[]>();
  private readonly commandTimestamps = new Map<string, number[]>();
  private readonly resumeTimestamps = new Map<string, number[]>();
  private readonly now: () => number;
  private readonly maxTrackedPeers: number;

  constructor(options: AdminAccessLimiterOptions = {}) {
    this.now = options.now ?? Date.now;
    this.maxTrackedPeers = options.maxTrackedPeers ?? MAX_TRACKED_PEERS;
  }

  canAttemptAuthentication(peerAddress: string): boolean {
    const failures = this.timestampsFor(this.authFailures, peerAddress, AUTH_FAILURE_WINDOW_MS);
    return failures.length < MAX_AUTH_FAILURES;
  }

  recordFailedAuthentication(peerAddress: string): boolean {
    const failures = this.timestampsFor(this.authFailures, peerAddress, AUTH_FAILURE_WINDOW_MS);
    failures.push(this.now());
    return failures.length >= MAX_AUTH_FAILURES;
  }

  clearFailedAuthentication(peerAddress: string): void {
    this.authFailures.delete(peerAddress);
  }

  acceptAuthenticatedCommand(peerAddress: string): boolean {
    const timestamps = this.timestampsFor(this.commandTimestamps, peerAddress, COMMAND_WINDOW_MS);
    if (timestamps.length >= MAX_COMMANDS) return false;
    timestamps.push(this.now());
    return true;
  }

  /** Limits reconnect resumption before an opaque session key is resolved. */
  acceptSessionResume(peerAddress: string): boolean {
    const timestamps = this.timestampsFor(this.resumeTimestamps, peerAddress, RESUME_WINDOW_MS);
    if (timestamps.length >= MAX_SESSION_RESUMES) return false;
    timestamps.push(this.now());
    return true;
  }

  private timestampsFor(
    entries: Map<string, number[]>,
    peerAddress: string,
    windowMs: number,
  ): number[] {
    const now = this.now();
    const timestamps = entries.get(peerAddress);
    if (timestamps) return retainRecent(timestamps, now, windowMs);
    evictOldestPeer(entries, this.maxTrackedPeers);
    const fresh: number[] = [];
    entries.set(peerAddress, fresh);
    return fresh;
  }
}

function retainRecent(timestamps: number[], now: number, windowMs: number): number[] {
  const recent = timestamps.filter((timestamp) => now - timestamp < windowMs);
  timestamps.splice(0, timestamps.length, ...recent);
  return timestamps;
}

function evictOldestPeer(entries: Map<string, number[]>, capacity: number): void {
  if (entries.size < capacity) return;
  const oldest = entries.keys().next().value;
  if (oldest) entries.delete(oldest);
}
