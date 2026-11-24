/** Server-side admin/debug authorization, environment gating, and constant-time token checks. */
import { createHash, timingSafeEqual } from "node:crypto";

export interface AdminAuthConfig {
  readonly allowOpenDevAdmin: boolean;
  readonly adminToken: string;
}

export interface AdminSessionAuthState {
  isAdmin: boolean;
  failedAuthAttempts: number;
}

const MAX_FAILED_AUTH_ATTEMPTS = 5;

export function resolveAdminAuthConfig(env: NodeJS.ProcessEnv = process.env): AdminAuthConfig {
  return {
    allowOpenDevAdmin: env.NODE_ENV !== "production" && env.DEBUG_COMMANDS !== "0",
    adminToken: (env.ADMIN_TOKEN ?? "").trim(),
  };
}

export function verifyAdminToken(candidate: string, expected: string): boolean {
  if (!candidate || !expected) return false;
  const a = createHash("sha256").update(candidate, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export function attemptAdminAuth(
  session: AdminSessionAuthState,
  token: string | undefined,
  config: AdminAuthConfig,
): boolean {
  if (session.isAdmin) return true;
  if (session.failedAuthAttempts >= MAX_FAILED_AUTH_ATTEMPTS) return false;
  if (token && config.adminToken && verifyAdminToken(token, config.adminToken)) {
    session.isAdmin = true;
    return true;
  }
  session.failedAuthAttempts += 1;
  return false;
}
