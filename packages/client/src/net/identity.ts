/** Tab-scoped browser identity with local-storage compatibility fallbacks. */

const RESUME_KEY = "dc2d-resume-token";
const CLIENT_ID_KEY = "dc2d-client-id";
const TAB_MARKER_PREFIX = "dc2d-tab:";
export interface IdentityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export interface IdentityStorageContext {
  readonly sessionStorage: IdentityStorage | null;
  readonly localStorage: IdentityStorage | null;
  /** A browser-context marker used to detect Chrome's duplicated sessionStorage. */
  readonly tabMarker?: TabMarker | null;
}
interface TabMarker {
  read(): string | null;
  write(value: string): boolean;
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
    tabMarker: browserTabMarker(),
  };
}
function browserTabMarker(): TabMarker | null {
  try {
    if (typeof globalThis.window === "undefined") return null;
    return {
      read: () => {
        const name = globalThis.window.name;
        return name.startsWith(TAB_MARKER_PREFIX)
          ? name.slice(TAB_MARKER_PREFIX.length) || null
          : null;
      },
      write: (value) => {
        try {
          globalThis.window.name = `${TAB_MARKER_PREFIX}${value}`;
          return true;
        } catch {
          return false;
        }
      },
    };
  } catch {
    return null;
  }
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
/** A duplicated tab must not attempt to resume the source tab's player. */
function clearCopiedResumeTokens(storage: IdentityStorage | null): void {
  for (const key of [RESUME_KEY, `${RESUME_KEY}:dungeon`, `${RESUME_KEY}:sandbox`]) {
    remove(storage, key);
  }
}

function resumeKey(level: string | undefined): string { return level ? `${RESUME_KEY}:${level}` : RESUME_KEY; }

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
  return read(storage.localStorage, resumeKey(level)).value ??
    read(storage.localStorage, RESUME_KEY).value ?? undefined;
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

export function persistentClientId(storage: IdentityStorageContext = browserStorageContext()): string {
  const sessionId = read(storage.sessionStorage, CLIENT_ID_KEY);
  if (sessionId.succeeded) {
    const sessionClient = resolveSessionClientId(storage, sessionId.value);
    if (sessionClient) return sessionClient;
  }
  return resolveFallbackClientId(storage);
}

function resolveSessionClientId(storage: IdentityStorageContext, sessionId: string | null): string | null {
  const marker = storage.tabMarker;
  if (!marker) return sessionId ?? persistGeneratedClientId(storage, false);

  const markerId = marker.read();
  // Chrome may clone sessionStorage when a tab is duplicated. A fresh
  // browsing context has no matching marker, so do not share the source
  // tab's identity or resume token.
  if (markerId && markerId === sessionId) return markerId;
  return persistGeneratedClientId(storage, true);
}

function persistGeneratedClientId(storage: IdentityStorageContext, clearResume: boolean): string {
  const generated = generateClientId();
  if (write(storage.sessionStorage, CLIENT_ID_KEY, generated)) {
    storage.tabMarker?.write(generated);
    if (clearResume) clearCopiedResumeTokens(storage.sessionStorage);
    return generated;
  }
  if (storage.tabMarker?.write(generated)) {
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

export function loadResumeToken(
  level?: string,
  storage: IdentityStorageContext = browserStorageContext(),
): string | undefined {
  const sessionToken = read(storage.sessionStorage, resumeKey(level));
  if (sessionToken.value) return sessionToken.value;
  if (sessionToken.succeeded && level) {
    const legacySessionToken = read(storage.sessionStorage, RESUME_KEY).value;
    if (legacySessionToken) return legacySessionToken;
  }
  return loadLocalResumeToken(level, storage, !sessionToken.succeeded);
}

export function saveResumeToken(
  token: string,
  level: string,
  storage: IdentityStorageContext = browserStorageContext(),
): void {
  if (write(storage.sessionStorage, resumeKey(level), token)) {
    remove(storage.sessionStorage, RESUME_KEY);
    return;
  }
  write(storage.localStorage, tabResumeKey(level, storage), token);
  if (!storage.tabMarker?.read()) remove(storage.localStorage, RESUME_KEY);
}

/** Purges a dead session's token so title auto-resume cannot loop into its expired slot. */
export function clearResumeToken(
  level: string,
  storage: IdentityStorageContext = browserStorageContext(),
): void {
  remove(storage.sessionStorage, resumeKey(level));
  remove(storage.sessionStorage, RESUME_KEY);
  remove(storage.localStorage, tabResumeKey(level, storage));
  remove(storage.localStorage, resumeKey(level));
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
