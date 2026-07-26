/** Tab-scoped browser identity with local-storage compatibility fallbacks. */

const RESUME_KEY = "dc2d-resume-token";
const CLIENT_ID_KEY = "dc2d-client-id";

export interface IdentityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface IdentityStorageContext {
  readonly sessionStorage: IdentityStorage | null;
  readonly localStorage: IdentityStorage | null;
}

interface StorageRead {
  readonly succeeded: boolean;
  readonly value: string | null;
}

function globalStorage(key: "sessionStorage" | "localStorage"): IdentityStorage | null {
  try {
    return typeof globalThis[key] === "undefined" ? null : globalThis[key];
  } catch {
    return null;
  }
}

function browserStorageContext(): IdentityStorageContext {
  return {
    sessionStorage: globalStorage("sessionStorage"),
    localStorage: globalStorage("localStorage"),
  };
}

function read(storage: IdentityStorage | null, key: string): StorageRead {
  if (!storage) return { succeeded: false, value: null };
  try {
    return { succeeded: true, value: storage.getItem(key) };
  } catch {
    return { succeeded: false, value: null };
  }
}

function write(storage: IdentityStorage | null, key: string, value: string): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function remove(storage: IdentityStorage | null, key: string): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * crypto.randomUUID exists only in SECURE contexts (https / localhost) — a phone
 * loading the dev box over plain http://192.168.x.x has crypto but not randomUUID.
 * getRandomValues works everywhere, so hand-roll a v4 UUID from it as the fallback.
 */
function generateClientId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function persistentClientId(
  storage: IdentityStorageContext = browserStorageContext(),
): string {
  const sessionId = read(storage.sessionStorage, CLIENT_ID_KEY);
  if (sessionId.succeeded) {
    if (sessionId.value) return sessionId.value;
    const generated = generateClientId();
    if (write(storage.sessionStorage, CLIENT_ID_KEY, generated)) return generated;
  }

  const localId = read(storage.localStorage, CLIENT_ID_KEY).value;
  if (localId) return localId;
  const generated = generateClientId();
  write(storage.localStorage, CLIENT_ID_KEY, generated);
  return generated;
}

export function loadResumeToken(
  level?: string,
  storage: IdentityStorageContext = browserStorageContext(),
): string | undefined {
  const sessionToken = read(
    storage.sessionStorage,
    level ? `${RESUME_KEY}:${level}` : RESUME_KEY,
  );
  if (sessionToken.succeeded) {
    return sessionToken.value ?? read(storage.sessionStorage, RESUME_KEY).value ?? undefined;
  }
  return (
    read(storage.localStorage, level ? `${RESUME_KEY}:${level}` : RESUME_KEY).value ??
    read(storage.localStorage, RESUME_KEY).value ??
    undefined
  );
}

export function saveResumeToken(
  token: string,
  level: string,
  storage: IdentityStorageContext = browserStorageContext(),
): void {
  if (write(storage.sessionStorage, `${RESUME_KEY}:${level}`, token)) {
    remove(storage.sessionStorage, RESUME_KEY);
    return;
  }
  write(storage.localStorage, `${RESUME_KEY}:${level}`, token);
  remove(storage.localStorage, RESUME_KEY);
}

/** Purges a dead session's token so title auto-resume cannot loop into its expired slot. */
export function clearResumeToken(
  level: string,
  storage: IdentityStorageContext = browserStorageContext(),
): void {
  if (storage.sessionStorage) {
    const removedLevel = remove(storage.sessionStorage, `${RESUME_KEY}:${level}`);
    const removedLegacy = remove(storage.sessionStorage, RESUME_KEY);
    if (removedLevel || removedLegacy) return;
  }
  remove(storage.localStorage, `${RESUME_KEY}:${level}`);
  remove(storage.localStorage, RESUME_KEY);
}

export function loadTabPreference(
  key: string,
  storage: IdentityStorageContext = browserStorageContext(),
): string | null {
  return read(storage.sessionStorage, key).value ?? read(storage.localStorage, key).value;
}

export function saveTabPreference(
  key: string,
  value: string,
  storage: IdentityStorageContext = browserStorageContext(),
): void {
  write(storage.sessionStorage, key, value);
  write(storage.localStorage, key, value);
}
