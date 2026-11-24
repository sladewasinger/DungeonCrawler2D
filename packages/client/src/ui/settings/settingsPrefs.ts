/** Persistent client preferences for FPS overlay, mobile auto-aim, and debug hitbox rendering. */

export interface SettingsPrefs {
  readonly showFps: boolean;
  readonly autoAim: boolean;
  readonly showHitboxes: boolean;
  readonly crouchMode: "toggle" | "hold";
}

const STORAGE_KEY = "dc2d_settings_prefs_v1";

export function isLocalDebugOrigin(hostname = typeof window === "undefined" ? "" : window.location.hostname): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
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
    if (!raw) return { showFps: defaultFps, autoAim: true, showHitboxes: false, crouchMode: "toggle" };
    const parsed = JSON.parse(raw) as Partial<SettingsPrefs>;
    return {
      showFps: typeof parsed.showFps === "boolean" ? parsed.showFps : defaultFps,
      autoAim: typeof parsed.autoAim === "boolean" ? parsed.autoAim : true,
      showHitboxes: typeof parsed.showHitboxes === "boolean" ? parsed.showHitboxes : false,
      crouchMode: parsed.crouchMode === "hold" ? "hold" : "toggle",
    };
  } catch {
    return { showFps: defaultFps, autoAim: true, showHitboxes: false, crouchMode: "toggle" };
  }
}

export function saveSettingsPrefs(prefs: SettingsPrefs): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota or private browsing errors.
  }
}