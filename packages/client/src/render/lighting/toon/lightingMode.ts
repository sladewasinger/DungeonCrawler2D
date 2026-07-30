import { TOON_LIGHTING_TUNING } from "./toonLightingTuning.js";

export const LIGHTING_MODES = {
  Classic: "classic",
  Toon: "toon",
} as const;

export type LightingMode =
  (typeof LIGHTING_MODES)[keyof typeof LIGHTING_MODES];

const STORAGE_KEY = "dc2d-lighting-mode";
let browserPersistedMode: LightingMode | null = null;
let browserPersistedLoaded = false;
let lastBrowserQuery: string | null = null;
let browserQueryMode: LightingMode | null = null;

export interface LightingModeResolution {
  readonly query: string;
  readonly persisted: LightingMode;
}

export function resolveLightingMode(
  input: LightingModeResolution,
): LightingMode {
  return lightingModeFromQuery(input.query) ?? input.persisted;
}

export function lightingModeFromQuery(query: string): LightingMode | null {
  const value = new URLSearchParams(query).get(
    TOON_LIGHTING_TUNING.queryParameter,
  );
  if (value === LIGHTING_MODES.Toon) return LIGHTING_MODES.Toon;
  if (value === LIGHTING_MODES.Classic) return LIGHTING_MODES.Classic;
  return null;
}

export function loadPersistedLightingMode(
  storage: Storage | undefined = browserStorage(),
): LightingMode {
  try {
    return parseLightingMode(storage?.getItem(STORAGE_KEY));
  } catch {
    return LIGHTING_MODES.Classic;
  }
}

export function savePersistedLightingMode(
  mode: LightingMode,
  storage: Storage | undefined = browserStorage(),
): void {
  browserPersistedMode = mode;
  browserPersistedLoaded = true;
  try {
    storage?.setItem(STORAGE_KEY, mode);
  } catch {
    // The player can still use the current-session value when storage is unavailable.
  }
}

export function currentLightingMode(
  query?: string,
  storage?: Storage | undefined,
): LightingMode {
  if (query === undefined && storage === undefined) return browserLightingMode();
  return resolveLightingMode({
    query: query ?? "",
    persisted: loadPersistedLightingMode(storage),
  });
}

export function lightingModeIsQueryForced(
  query = browserQuery(),
): boolean {
  return lightingModeFromQuery(query) !== null;
}

export function parseLightingMode(value: unknown): LightingMode {
  return value === LIGHTING_MODES.Toon
    ? LIGHTING_MODES.Toon
    : LIGHTING_MODES.Classic;
}

function browserLightingMode(): LightingMode {
  const query = browserQuery();
  if (query !== lastBrowserQuery) {
    lastBrowserQuery = query;
    browserQueryMode = lightingModeFromQuery(query);
  }
  return browserQueryMode ?? browserPersistedLightingMode();
}

function browserPersistedLightingMode(): LightingMode {
  if (!browserPersistedLoaded) {
    browserPersistedMode = loadPersistedLightingMode();
    browserPersistedLoaded = true;
  }
  return browserPersistedMode ?? LIGHTING_MODES.Classic;
}

function browserQuery(): string {
  return typeof globalThis.location === "undefined"
    ? ""
    : globalThis.location.search;
}

function browserStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}
