const STORAGE_KEY = "dc2d-experimental-corpnet";
const SCHEMA_VERSION = 1;

export interface ExperimentalCorpNetSettings {
  readonly schemaVersion: 1;
  readonly enabled: boolean;
}

export const DEFAULT_EXPERIMENTAL_CORPNET_SETTINGS: ExperimentalCorpNetSettings = {
  schemaVersion: SCHEMA_VERSION,
  enabled: false,
};

export function parseExperimentalCorpNetSettings(value: unknown): ExperimentalCorpNetSettings {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_EXPERIMENTAL_CORPNET_SETTINGS };
  }
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== SCHEMA_VERSION || typeof record.enabled !== "boolean") {
    return { ...DEFAULT_EXPERIMENTAL_CORPNET_SETTINGS };
  }
  return { schemaVersion: SCHEMA_VERSION, enabled: record.enabled };
}

export function loadExperimentalCorpNetSettings(): ExperimentalCorpNetSettings {
  if (typeof globalThis.localStorage === "undefined") {
    return { ...DEFAULT_EXPERIMENTAL_CORPNET_SETTINGS };
  }
  try {
    return parseExperimentalCorpNetSettings(
      JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY) ?? "null"),
    );
  } catch {
    return { ...DEFAULT_EXPERIMENTAL_CORPNET_SETTINGS };
  }
}

export function saveExperimentalCorpNetSettings(
  value: ExperimentalCorpNetSettings,
): ExperimentalCorpNetSettings {
  const settings = parseExperimentalCorpNetSettings(value);
  if (typeof globalThis.localStorage === "undefined") return settings;
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // The setting remains active for this connection when browser storage is unavailable.
  }
  return settings;
}
