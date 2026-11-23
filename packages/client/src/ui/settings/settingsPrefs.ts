/** Persistent client preferences for FPS overlay, mobile auto-aim, and debug hitbox rendering. */

export interface SettingsPrefs {
  readonly showFps: boolean;
  readonly autoAim: boolean;
  readonly showHitboxes: boolean;
}

const STORAGE_KEY = "dc2d_settings_prefs_v1";

export function isLocalDebugOrigin(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  const params = new URLSearchParams(window.location.search);
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || ["1", "true"].includes(params.get("debug") ?? "");
}

function isCoarseMobileDefault(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.matchMedia?.("(hover: none), (pointer: coarse), (max-width: 900px)")?.matches,
  );
}

export function loadSettingsPrefs(): SettingsPrefs {
  const defaultFps = !isCoarseMobileDefault();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { showFps: defaultFps, autoAim: true, showHitboxes: false };
    const parsed = JSON.parse(raw) as Partial<SettingsPrefs>;
    return {
      showFps: typeof parsed.showFps === "boolean" ? parsed.showFps : defaultFps,
      autoAim: typeof parsed.autoAim === "boolean" ? parsed.autoAim : true,
      showHitboxes: typeof parsed.showHitboxes === "boolean" ? parsed.showHitboxes : false,
    };
  } catch {
    return { showFps: defaultFps, autoAim: true, showHitboxes: false };
  }
}

export function saveSettingsPrefs(prefs: SettingsPrefs): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota or private browsing errors.
  }
}