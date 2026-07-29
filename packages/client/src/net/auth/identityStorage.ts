const TAB_MARKER_PREFIX = "dc2d-tab:";

export interface IdentityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface TabMarker {
  read(): string | null;
  write(value: string): boolean;
}

export interface IdentityStorageContext {
  readonly sessionStorage: IdentityStorage | null;
  readonly localStorage: IdentityStorage | null;
  readonly tabMarker?: TabMarker | null;
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

export function browserStorageContext(): IdentityStorageContext {
  return {
    sessionStorage: globalStorage("sessionStorage"),
    localStorage: globalStorage("localStorage"),
    tabMarker: browserTabMarker(),
  };
}

function browserTabMarker(): TabMarker | null {
  try {
    if (typeof globalThis.window === "undefined") return null;
    return { read: readBrowserTabMarker, write: writeBrowserTabMarker };
  } catch {
    return null;
  }
}

function readBrowserTabMarker(): string | null {
  const name = globalThis.window.name;
  return name.startsWith(TAB_MARKER_PREFIX) ? name.slice(TAB_MARKER_PREFIX.length) || null : null;
}

function writeBrowserTabMarker(value: string): boolean {
  try {
    globalThis.window.name = `${TAB_MARKER_PREFIX}${value}`;
    return true;
  } catch {
    return false;
  }
}

export function read(storage: IdentityStorage | null, key: string): StorageRead {
  if (!storage) return { succeeded: false, value: null };
  try {
    return { succeeded: true, value: storage.getItem(key) };
  } catch {
    return { succeeded: false, value: null };
  }
}

export function write(storage: IdentityStorage | null, key: string, value: string): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function remove(storage: IdentityStorage | null, key: string): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
