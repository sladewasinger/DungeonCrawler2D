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

export type AdminSessionInvalidationReason = "expired" | "revoked";

export interface AdminSessionValidation {
  readonly session: AdminSession;
  readonly peerAddress: string;
}

export interface AdminSessionBinding extends AdminSessionValidation {
  readonly binding: object;
  readonly onInvalidated: (reason: AdminSessionInvalidationReason) => void;
}

interface StoredAdminSession {
  readonly session: AdminSession;
  readonly peerAddress: string;
  readonly bindings: Map<object, AdminSessionBinding["onInvalidated"]>;
  expiresAt: number;
}

/**
 * Process-local continuation keys for the separate admin WebSocket. The key is
 * opaque, 256-bit, peer-bound, and intentionally disappears when the server
 * restarts; it is not the configured ADMIN_TOKEN.
 */
export class AdminSessionRegistry {
  private readonly sessions = new Map<string, StoredAdminSession>();
  private readonly activeSessions = new Map<string, StoredAdminSession>();
  private readonly bindingSessions = new Map<object, StoredAdminSession>();
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
    const stored = this.newStoredSession(input, now);
    this.sessions.set(sessionKey, stored);
    this.activeSessions.set(input.session.sessionId, stored);
    return sessionKey;
  }

  resume(input: AdminSessionResume): AdminSession | null {
    const now = this.now();
    const stored = this.sessions.get(input.sessionKey);
    if (!stored) return null;
    if (stored.expiresAt <= now) {
      this.invalidate(stored, "expired");
      return null;
    }
    if (stored.peerAddress !== input.peerAddress) return null;
    stored.expiresAt = now + this.sessionTtlMs;
    return stored.session;
  }

  /** Verifies an open admin socket against the same TTL and peer binding. */
  isActive(input: AdminSessionValidation): boolean {
    const stored = this.activeSessions.get(input.session.sessionId);
    if (!stored || stored.session !== input.session || stored.peerAddress !== input.peerAddress) return false;
    if (stored.expiresAt > this.now()) return true;
    this.invalidate(stored, "expired"); return false;
  }

  /** Extends a verified session only after an authorized operator action. */
  touch(input: AdminSessionValidation): boolean {
    const stored = this.activeSessions.get(input.session.sessionId);
    if (!stored || !this.isActive(input)) return false;
    stored.expiresAt = this.now() + this.sessionTtlMs;
    return true;
  }

  /** Associates an authenticated socket with its revocable live session. */
  bind(input: AdminSessionBinding): boolean {
    if (!this.isActive(input)) return false;
    this.unbind(input.binding);
    const stored = this.activeSessions.get(input.session.sessionId);
    if (!stored) return false;
    stored.bindings.set(input.binding, input.onInvalidated);
    this.bindingSessions.set(input.binding, stored);
    return true;
  }

  /** Releases a socket binding without ending its continuation session. */
  unbind(binding: object): void {
    const stored = this.bindingSessions.get(binding);
    if (!stored) return;
    stored.bindings.delete(binding);
    this.bindingSessions.delete(binding);
  }

  /** Revokes every continuation key for this authenticated server-side session. */
  revoke(session: AdminSession): boolean {
    const stored = this.activeSessions.get(session.sessionId);
    if (!stored || stored.session !== session) return false;
    this.invalidate(stored, "revoked");
    return true;
  }

  private pruneExpiredBounded(now: number): void {
    let inspected = 0;
    for (const session of this.activeSessions.values()) {
      if (session.expiresAt <= now) this.invalidate(session, "expired");
      inspected += 1;
      if (inspected >= ISSUE_PRUNE_BUDGET) return;
    }
  }

  private evictOldestIfFull(): void {
    if (this.sessions.size < this.maxSessions) return;
    const oldest = this.sessions.keys().next().value;
    const stored = oldest ? this.sessions.get(oldest) : undefined;
    if (stored) this.invalidate(stored, "revoked");
  }

  private newStoredSession(input: AdminSessionIssue, now: number): StoredAdminSession {
    return {
      session: input.session,
      peerAddress: input.peerAddress,
      bindings: new Map(),
      expiresAt: now + this.sessionTtlMs,
    };
  }

  private invalidate(
    stored: StoredAdminSession,
    reason: AdminSessionInvalidationReason,
  ): void {
    this.activeSessions.delete(stored.session.sessionId);
    this.removeContinuationKeys(stored);
    this.notifyBindings(stored, reason);
  }

  private removeContinuationKeys(stored: StoredAdminSession): void {
    for (const [key, candidate] of this.sessions) {
      if (candidate === stored) this.sessions.delete(key);
    }
  }

  private notifyBindings(
    stored: StoredAdminSession,
    reason: AdminSessionInvalidationReason,
  ): void {
    const bindings = [...stored.bindings.entries()];
    stored.bindings.clear();
    for (const [binding, notify] of bindings) {
      this.bindingSessions.delete(binding);
      notify(reason);
    }
  }
}

function createSessionKey(): string {
  return randomBytes(32).toString("base64url");
}
