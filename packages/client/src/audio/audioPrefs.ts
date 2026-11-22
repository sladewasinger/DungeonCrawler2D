/** Persistent music, SFX, and mute preferences stored in localStorage. */

export interface AudioPrefs {
  readonly muted: boolean;
  readonly music: number;
  readonly sfx: number;
}

const STORAGE_KEY = "dc2d_audio_prefs_v1";
export const DEFAULT_AUDIO_PREFS: AudioPrefs = { muted: false, music: 0.55, sfx: 0.75 };

function clampUnit(val: unknown, fallback: number): number {
  if (typeof val !== "number" || Number.isNaN(val)) return fallback;
  return Math.max(0, Math.min(1, val));
}

export function loadAudioPrefs(): AudioPrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AUDIO_PREFS;
    const parsed = JSON.parse(raw) as Partial<AudioPrefs>;
    return {
      muted: Boolean(parsed.muted),
      music: clampUnit(parsed.music, DEFAULT_AUDIO_PREFS.music),
      sfx: clampUnit(parsed.sfx, DEFAULT_AUDIO_PREFS.sfx),
    };
  } catch {
    return DEFAULT_AUDIO_PREFS;
  }
}

export function saveAudioPrefs(prefs: AudioPrefs): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota or private browsing errors.
  }
}
