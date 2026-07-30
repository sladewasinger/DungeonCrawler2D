const STORAGE_KEY = "dc2d-device-presentation-settings";
const SCHEMA_VERSION = 1;

export type DevicePresentationMode = "auto" | "constrained";

export interface DevicePresentationSettings {
  readonly schemaVersion: 1;
  readonly mode: DevicePresentationMode;
}

export const DEFAULT_DEVICE_PRESENTATION_SETTINGS: DevicePresentationSettings = {
  schemaVersion: SCHEMA_VERSION,
  mode: "auto",
};

export function parseDevicePresentationSettings(
  value: unknown,
): DevicePresentationSettings {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_DEVICE_PRESENTATION_SETTINGS };
  }
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== SCHEMA_VERSION) {
    return { ...DEFAULT_DEVICE_PRESENTATION_SETTINGS };
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    mode: record.mode === "constrained" ? "constrained" : "auto",
  };
}

export function loadDevicePresentationSettings(): DevicePresentationSettings {
  if (typeof globalThis.localStorage === "undefined") {
    return { ...DEFAULT_DEVICE_PRESENTATION_SETTINGS };
  }
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    return parseDevicePresentationSettings(JSON.parse(raw ?? "null"));
  } catch {
    return { ...DEFAULT_DEVICE_PRESENTATION_SETTINGS };
  }
}

export function saveDevicePresentationMode(
  mode: DevicePresentationMode,
): DevicePresentationSettings {
  const settings: DevicePresentationSettings = {
    schemaVersion: SCHEMA_VERSION,
    mode,
  };
  if (typeof globalThis.localStorage === "undefined") return settings;
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // The next load falls back to automatic detection when storage is unavailable.
  }
  return settings;
}
