const COMMAND_WINDOW_MS = 5_000;
const MAX_COMMANDS_PER_WINDOW = 12;
const MAX_STARTS_PER_WINDOW = 4;
const PEER_STATE_RETENTION_MS = COMMAND_WINDOW_MS;
const MAX_TRACKED_PEERS = 10_000;

interface RateWindow {
  timestamps: number[];
}

interface SpectatorPeerState {
  readonly commands: RateWindow;
  readonly starts: RateWindow;
  lastTargetChangeAt: number;
  lastSeenAt: number;
}

interface PeerRateRequest {
  readonly windowFor: (peer: SpectatorPeerState) => RateWindow;
  readonly limit: number;
}

/**
 * Peer limits outlive a socket briefly. Otherwise a client can bypass every
 * per-socket limit by reconnecting between messages.
 */
export class SpectatorRateLimits {
  private readonly peers = new Map<string, SpectatorPeerState>();

  allowStart(peerAddress: string, now = Date.now()): boolean {
    return this.allow(peerAddress, now, {
      windowFor: (peer) => peer.starts,
      limit: MAX_STARTS_PER_WINDOW,
    });
  }

  allowCommand(peerAddress: string, socketWindow: RateWindow, now = Date.now()): boolean {
    if (!record(socketWindow, now, MAX_COMMANDS_PER_WINDOW)) return false;
    return this.allow(peerAddress, now, {
      windowFor: (peer) => peer.commands,
      limit: MAX_COMMANDS_PER_WINDOW,
    });
  }

  lastTargetChangeAt(peerAddress: string, now = Date.now()): number {
    return this.peer(peerAddress, now).lastTargetChangeAt;
  }

  recordTargetChange(peerAddress: string, now = Date.now()): void {
    const peer = this.peer(peerAddress, now);
    peer.lastTargetChangeAt = now;
  }

  release(peerAddress: string, now = Date.now()): void {
    this.prune(now);
    const peer = this.peers.get(peerAddress);
    if (peer) peer.lastSeenAt = now;
  }

  private allow(
    peerAddress: string,
    now: number,
    request: PeerRateRequest,
  ): boolean {
    const peer = this.peer(peerAddress, now);
    return record(request.windowFor(peer), now, request.limit);
  }

  private peer(peerAddress: string, now: number): SpectatorPeerState {
    this.prune(now);
    const existing = this.peers.get(peerAddress);
    if (existing) return touch(existing, now);
    this.evictOldestPeerIfFull();
    const created = createPeerState(now);
    this.peers.set(peerAddress, created);
    return created;
  }

  private prune(now: number): void {
    for (const [address, peer] of this.peers) {
      if (now - peer.lastSeenAt >= PEER_STATE_RETENTION_MS) this.peers.delete(address);
    }
  }

  private evictOldestPeerIfFull(): void {
    if (this.peers.size < MAX_TRACKED_PEERS) return;
    const oldest = [...this.peers.entries()]
      .sort(([, left], [, right]) => left.lastSeenAt - right.lastSeenAt)[0];
    if (oldest) this.peers.delete(oldest[0]);
  }
}

export function createSpectatorRateWindow(): RateWindow {
  return { timestamps: [] };
}

function createPeerState(now: number): SpectatorPeerState {
  return {
    commands: createSpectatorRateWindow(),
    starts: createSpectatorRateWindow(),
    lastTargetChangeAt: 0,
    lastSeenAt: now,
  };
}

function touch(peer: SpectatorPeerState, now: number): SpectatorPeerState {
  peer.lastSeenAt = now;
  return peer;
}

function record(window: RateWindow, now: number, limit: number): boolean {
  window.timestamps = window.timestamps.filter((time) => now - time < COMMAND_WINDOW_MS);
  if (window.timestamps.length >= limit) return false;
  window.timestamps.push(now);
  return true;
}

export type SpectatorRateWindow = RateWindow;
