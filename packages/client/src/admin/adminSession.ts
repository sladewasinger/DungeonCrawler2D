import {
  browserStorageContext,
  read,
  remove,
  write,
  type IdentityStorage,
} from "../net/auth/identityStorage.js";

const ADMIN_SESSION_KEY = "dc2d-admin-session-v1";
const SESSION_KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * Keeps only an opaque server-issued continuation key in tab-scoped storage.
 * The configured ADMIN_TOKEN is never persisted by the browser.
 */
export function loadAdminSessionKey(storage: IdentityStorage | null = browserStorageContext().sessionStorage): string | undefined {
  const value = read(storage, ADMIN_SESSION_KEY).value;
  return value && SESSION_KEY_PATTERN.test(value) ? value : undefined;
}

export function saveAdminSessionKey(
  sessionKey: string,
  storage: IdentityStorage | null = browserStorageContext().sessionStorage,
): boolean {
  if (!SESSION_KEY_PATTERN.test(sessionKey)) return false;
  return write(storage, ADMIN_SESSION_KEY, sessionKey);
}

export function clearAdminSessionKey(
  storage: IdentityStorage | null = browserStorageContext().sessionStorage,
): void {
  remove(storage, ADMIN_SESSION_KEY);
}
