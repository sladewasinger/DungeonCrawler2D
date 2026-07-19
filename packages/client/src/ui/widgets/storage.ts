/** localStorage persistence for the HUD layout config, guarded for non-browser environments (tests, SSR). */
import { createEmptyConfig, type LayoutConfig, type WidgetOverride } from "./state.js";

function hasLocalStorage(): boolean {
  return typeof globalThis.localStorage !== "undefined";
}

/** Narrow-parses arbitrary JSON into a LayoutConfig shape, dropping anything malformed. */
function parseConfig(raw: unknown): LayoutConfig {
  const config = createEmptyConfig();
  if (typeof raw !== "object" || raw === null) return config;
  const widgets = (raw as { widgets?: unknown }).widgets;
  if (typeof widgets !== "object" || widgets === null) return config;
  for (const [id, value] of Object.entries(widgets as Record<string, unknown>)) {
    if (typeof value === "object" && value !== null) {
      config.widgets[id] = value as WidgetOverride;
    }
  }
  return config;
}

/** Loads the persisted layout override set, or null when none is stored / storage is unavailable. */
export function loadPersistedLayout(storageKey: string): LayoutConfig | null {
  if (!hasLocalStorage()) return null;
  const raw = globalThis.localStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    return parseConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Persists the current layout override set; a no-op when storage is unavailable. */
export function savePersistedLayout(storageKey: string, config: LayoutConfig): void {
  if (!hasLocalStorage()) return;
  globalThis.localStorage.setItem(storageKey, JSON.stringify(config));
}
