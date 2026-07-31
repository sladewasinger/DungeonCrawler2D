import { randomBytes } from "node:crypto";
import type { AdminSession } from "./authorization.js";

const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const DEFAULT_MAX_SESSIONS = 10_000;
const ISSUE_PRUNE_BUDGET = 64;

export interface AdminSessionRegistryOptions {
  readonly now?: () => number;
  readonly sessionTtlMs?: number;
  readonly maxSessions?: number;
}

export interface AdminSessionIssue {
  readonly session: AdminSession;
  readonly peerAddress: string;
}

export interface AdminSessionResume {
  readonly sessionKey: string;
  readonly peerAddress: string;
}

interface StoredAdminSession {
  readonly session: AdminSession;
  readonly peerAddress: string;
  expiresAt: number;
}

/**
 * Process-local continuation keys for the separate admin WebSocket. The key is
 * opaque, 256-bit, peer-bound, and intentionally disappears when the server
 * restarts; it is not the configured ADMIN_TOKEN.
 */
export class AdminSessionRegistry {
  private readonly sessions = new Map<string, StoredAdminSession>();
  private readonly now: () => number;
  private readonly sessionTtlMs: number;
  private readonly maxSessions: number;

  constructor(options: AdminSessionRegistryOptions = {}) {
    this.now = options.now ?? Date.now;
    this.sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
    this.maxSessions = options.maxSessions ?? DEFAULT_MAX_SESSIONS;
  }

  issue(input: AdminSessionIssue): string {
    const now = this.now();
    this.pruneExpiredBounded(now);
    this.evictOldestIfFull();
    const sessionKey = createSessionKey();
    this.sessions.set(sessionKey, {
      session: input.session,
      peerAddress: input.peerAddress,
      expiresAt: now + this.sessionTtlMs,
    });
    return sessionKey;
  }

  resume(input: AdminSessionResume): AdminSession | null {
    const now = this.now();
    const stored = this.sessions.get(input.sessionKey);
    if (!stored) return null;
    if (stored.expiresAt <= now) {
      this.sessions.delete(input.sessionKey);
      return null;
    }
    if (stored.peerAddress !== input.peerAddress) return null;
    stored.expiresAt = now + this.sessionTtlMs;
    return stored.session;
  }

  private pruneExpiredBounded(now: number): void {
    let inspected = 0;
    for (const [sessionKey, session] of this.sessions) {
      if (session.expiresAt <= now) this.sessions.delete(sessionKey);
      inspected += 1;
      if (inspected >= ISSUE_PRUNE_BUDGET) return;
    }
  }

  private evictOldestIfFull(): void {
    if (this.sessions.size < this.maxSessions) return;
    const oldest = this.sessions.keys().next().value;
    if (oldest) this.sessions.delete(oldest);
  }
}

function createSessionKey(): string {
  return randomBytes(32).toString("base64url");
}
