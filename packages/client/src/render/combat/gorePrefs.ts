/** Persistent player gore intensity preference stored in localStorage. */

export type GoreLevel = "full" | "reduced" | "off";

const STORAGE_KEY = "dc2d_gore_level_v1";

export function loadGoreLevel(): GoreLevel {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "full" || raw === "reduced" || raw === "off") return raw;
  } catch {
    // Ignore storage access errors in headless or private mode.
  }
  return "full";
}

export function saveGoreLevel(level: GoreLevel): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, level);
  } catch {
    // Ignore storage quota or private browsing errors.
  }
}

export function goreScaleForLevel(level: GoreLevel): number {
  if (level === "off") return 0;
  return level === "reduced" ? 0.42 : 1;
}
