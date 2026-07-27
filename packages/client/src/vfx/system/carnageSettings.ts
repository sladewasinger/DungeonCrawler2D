const STORAGE_KEY = "dc2d-carnage-settings";
const SCHEMA_VERSION = 1;

export const MIN_CARNAGE_INTENSITY = 0.5;
export const MAX_CARNAGE_INTENSITY = 2;
export const MIN_BLOOD_DROP_INTENSITY = 0;
export const MAX_BLOOD_DROP_INTENSITY = 1;
export const MIN_STREAK_LIMIT = 0;
export const MAX_STREAK_LIMIT = 16;
export const MIN_CHUNK_LIMIT = 0;
export const MAX_CHUNK_LIMIT = 12;

export interface CarnageSettings {
  schemaVersion: 1;
  enabled: boolean;
  bloodEnabled: boolean;
  bloodDropIntensity: number;
  intensity: number;
  streakLimit: number;
  chunkLimit: number;
}

export const DEFAULT_CARNAGE_SETTINGS: CarnageSettings = {
  schemaVersion: SCHEMA_VERSION,
  enabled: false,
  bloodEnabled: true,
  bloodDropIntensity: 1,
  intensity: 1,
  streakLimit: 8,
  chunkLimit: 6,
};

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const finite = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

export function parseCarnageSettings(value: unknown): CarnageSettings {
  if (!value || typeof value !== "object") return { ...DEFAULT_CARNAGE_SETTINGS };
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== SCHEMA_VERSION) return { ...DEFAULT_CARNAGE_SETTINGS };
  return {
    schemaVersion: SCHEMA_VERSION,
    enabled: booleanSetting(record.enabled, DEFAULT_CARNAGE_SETTINGS.enabled),
    bloodEnabled: booleanSetting(record.bloodEnabled, DEFAULT_CARNAGE_SETTINGS.bloodEnabled),
    bloodDropIntensity: numericSetting({ value: record.bloodDropIntensity, fallback: DEFAULT_CARNAGE_SETTINGS.bloodDropIntensity, minimum: MIN_BLOOD_DROP_INTENSITY, maximum: MAX_BLOOD_DROP_INTENSITY }),
    intensity: numericSetting({ value: record.intensity, fallback: DEFAULT_CARNAGE_SETTINGS.intensity, minimum: MIN_CARNAGE_INTENSITY, maximum: MAX_CARNAGE_INTENSITY }),
    streakLimit: Math.round(numericSetting({ value: record.streakLimit, fallback: DEFAULT_CARNAGE_SETTINGS.streakLimit, minimum: MIN_STREAK_LIMIT, maximum: MAX_STREAK_LIMIT })),
    chunkLimit: Math.round(numericSetting({ value: record.chunkLimit, fallback: DEFAULT_CARNAGE_SETTINGS.chunkLimit, minimum: MIN_CHUNK_LIMIT, maximum: MAX_CHUNK_LIMIT })),
  };
}

function booleanSetting(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function numericSetting({ value, fallback, minimum, maximum }: {
  readonly value: unknown;
  readonly fallback: number;
  readonly minimum: number;
  readonly maximum: number;
}): number {
  return clamp(finite(value, fallback), minimum, maximum);
}

export function loadCarnageSettings(): CarnageSettings {
  if (typeof globalThis.localStorage === "undefined") {
    return { ...DEFAULT_CARNAGE_SETTINGS };
  }
  try {
    return parseCarnageSettings(
      JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY) ?? "null"),
    );
  } catch {
    return { ...DEFAULT_CARNAGE_SETTINGS };
  }
}

export function saveCarnageSettings(value: CarnageSettings): CarnageSettings {
  const next = parseCarnageSettings(value);
  if (typeof globalThis.localStorage === "undefined") return next;
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return next;
  }
  return next;
}
