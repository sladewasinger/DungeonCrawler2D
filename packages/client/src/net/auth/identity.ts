/** Tab-scoped browser identity with local-storage compatibility fallbacks. */

import {
  browserStorageContext,
  read,
  remove,
  write,
  type IdentityStorage,
  type IdentityStorageContext,
} from "./identityStorage.js";

export type { IdentityStorage, IdentityStorageContext } from "./identityStorage.js";

const RESUME_KEY = "dc2d-resume-token";
const CLIENT_ID_KEY = "dc2d-client-id";

function clearCopiedResumeTokens(storage: IdentityStorage | null): void {
  for (const key of [RESUME_KEY, `${RESUME_KEY}:dungeon`, `${RESUME_KEY}:sandbox`]) remove(storage, key);
}

function resumeKey(level: string | undefined): string {
  return level ? `${RESUME_KEY}:${level}` : RESUME_KEY;
}

function tabResumeKey(level: string | undefined, storage: IdentityStorageContext): string {
  const tabId = storage.tabMarker?.read();
  return tabId ? `${RESUME_KEY}:tab:${tabId}:${level ?? "legacy"}` : resumeKey(level);
}

function loadLocalResumeToken(
  level: string | undefined,
  storage: IdentityStorageContext,
  allowSharedFallback: boolean,
): string | undefined {
  const tabId = storage.tabMarker?.read();
  if (tabId) return read(storage.localStorage, tabResumeKey(level, storage)).value ?? undefined;
  if (!allowSharedFallback) return undefined;
  return read(storage.localStorage, resumeKey(level)).value ?? read(storage.localStorage, RESUME_KEY).value ?? undefined;
}

function generateClientId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function persistentClientId(storage: IdentityStorageContext = browserStorageContext()): string {
  const sessionId = read(storage.sessionStorage, CLIENT_ID_KEY);
  if (sessionId.succeeded) return resolveSessionClientId(storage, sessionId.value) ?? resolveFallbackClientId(storage);
  return resolveFallbackClientId(storage);
}

function resolveSessionClientId(storage: IdentityStorageContext, sessionId: string | null): string | null {
  const marker = storage.tabMarker;
  if (!marker) return sessionId ?? persistGeneratedClientId(storage, false);
  return marker.read() === sessionId && sessionId ? sessionId : persistGeneratedClientId(storage, true);
}

function persistGeneratedClientId(storage: IdentityStorageContext, clearResume: boolean): string {
  const generated = generateClientId();
  const sessionPersisted = write(storage.sessionStorage, CLIENT_ID_KEY, generated);
  const markerPersisted = storage.tabMarker?.write(generated) ?? false;
  if (sessionPersisted || markerPersisted) {
    if (clearResume) clearCopiedResumeTokens(storage.sessionStorage);
    return generated;
  }
  return resolveFallbackClientId(storage);
}

function resolveFallbackClientId(storage: IdentityStorageContext): string {
  const marker = storage.tabMarker;
  const markerId = marker?.read() ?? null;
  if (markerId) return markerId;
  const localId = read(storage.localStorage, CLIENT_ID_KEY).value;
  if (localId && !marker) return localId;
  const generated = generateClientId();
  write(storage.localStorage, CLIENT_ID_KEY, generated);
  marker?.write(generated);
  return generated;
}

export function loadResumeToken(level?: string, storage: IdentityStorageContext = browserStorageContext()): string | undefined {
  const sessionToken = read(storage.sessionStorage, resumeKey(level));
  if (sessionToken.value) return sessionToken.value;
  if (sessionToken.succeeded && level) {
    const legacySessionToken = read(storage.sessionStorage, RESUME_KEY).value;
    if (legacySessionToken) return legacySessionToken;
  }
  return loadLocalResumeToken(level, storage, !sessionToken.succeeded);
}

export function saveResumeToken(token: string, level: string, storage: IdentityStorageContext = browserStorageContext()): void {
  if (write(storage.sessionStorage, resumeKey(level), token)) {
    remove(storage.sessionStorage, RESUME_KEY);
    return;
  }
  write(storage.localStorage, tabResumeKey(level, storage), token);
  if (!storage.tabMarker?.read()) remove(storage.localStorage, RESUME_KEY);
}

export function clearResumeToken(level: string, storage: IdentityStorageContext = browserStorageContext()): void {
  for (const target of [storage.sessionStorage, storage.localStorage]) {
    remove(target, resumeKey(level));
    remove(target, RESUME_KEY);
  }
  remove(storage.localStorage, tabResumeKey(level, storage));
}

export function loadTabPreference(key: string, storage: IdentityStorageContext = browserStorageContext()): string | null {
  return read(storage.sessionStorage, key).value ?? read(storage.localStorage, key).value;
}

export function saveTabPreference(key: string, value: string, storage: IdentityStorageContext = browserStorageContext()): void {
  write(storage.sessionStorage, key, value);
  write(storage.localStorage, key, value);
}
