/** Server-side admin/debug authorization, environment gating, and constant-time token checks. */
import { createHash, timingSafeEqual } from "node:crypto";

export interface AdminAuthConfig {
  readonly allowOpenDevAdmin: boolean;
  readonly adminToken: string;
}

export interface AdminSessionAuthState {
  isAdmin: boolean;
  failedAuthAttempts: number;
  readonly clientIp?: string | undefined;
  readonly playerId?: string | undefined;
}

const MAX_FAILED_AUTH_ATTEMPTS = 5;
const IP_LOCKOUT_MS = 15 * 60_000;
const ipFailureState = new Map<string, { count: number; lockedUntilMs: number }>();

export function resolveAdminAuthConfig(env: NodeJS.ProcessEnv = process.env): AdminAuthConfig {
  return {
    allowOpenDevAdmin: env.NODE_ENV !== "production" && env.ALLOW_OPEN_DEV_ADMIN === "1" && env.DEBUG_COMMANDS !== "0",
    adminToken: (env.ADMIN_TOKEN ?? "").trim(),
  };
}

export function verifyAdminToken(candidate: string, expected: string): boolean {
  if (!candidate || !expected) return false;
  const a = createHash("sha256").update(candidate, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export function resetAdminIpLockouts(): void {
  ipFailureState.clear();
}

function isIpLocked(ip: string | undefined, nowMs: number): boolean {
  if (!ip) return false;
  const rec = ipFailureState.get(ip);
  if (!rec) return false;
  if (rec.lockedUntilMs <= nowMs) {
    if (rec.lockedUntilMs > 0) ipFailureState.delete(ip);
    return false;
  }
  return true;
}

function evictOverflowLockouts(): void {
  while (ipFailureState.size >= 2048) {
    const oldest = ipFailureState.keys().next().value;
    if (oldest === undefined) break;
    ipFailureState.delete(oldest);
  }
}

function pruneExpiredLockouts(nowMs: number): void {
  if (ipFailureState.size <= 1024) return;
  for (const [k, v] of ipFailureState) {
    if (v.lockedUntilMs > 0 && v.lockedUntilMs <= nowMs) ipFailureState.delete(k);
  }
  evictOverflowLockouts();
}

function recordIpFailure(ip: string | undefined, nowMs: number): void {
  if (!ip) return;
  pruneExpiredLockouts(nowMs);
  const prev = ipFailureState.get(ip) ?? { count: 0, lockedUntilMs: 0 };
  const count = prev.count + 1;
  ipFailureState.set(ip, { count, lockedUntilMs: count >= MAX_FAILED_AUTH_ATTEMPTS ? nowMs + IP_LOCKOUT_MS : 0 });
}

function logAdminAuthAttempt(ok: boolean, session: AdminSessionAuthState): void {
  console.log(JSON.stringify({ event: "admin_auth", ok, ip: session.clientIp ?? "unknown", playerId: session.playerId }));
}

export function attemptAdminAuth(
  session: AdminSessionAuthState,
  token: string | undefined,
  config: AdminAuthConfig,
): boolean {
  if (session.isAdmin) return true;
  const nowMs = Date.now();
  if (session.failedAuthAttempts >= MAX_FAILED_AUTH_ATTEMPTS || isIpLocked(session.clientIp, nowMs)) return false;
  const valid = Boolean(token && config.adminToken && verifyAdminToken(token, config.adminToken));
  if (valid) {
    session.isAdmin = true;
    if (session.clientIp) ipFailureState.delete(session.clientIp);
    logAdminAuthAttempt(true, session);
    return true;
  }
  session.failedAuthAttempts += 1;
  recordIpFailure(session.clientIp, nowMs);
  logAdminAuthAttempt(false, session);
  return false;
}
