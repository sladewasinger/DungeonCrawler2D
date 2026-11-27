/** Persistent music, SFX, and mute preferences stored in localStorage. */
import { z } from "zod";

export interface AudioPrefs {
  readonly muted: boolean;
  readonly music: number;
  readonly sfx: number;
}

const STORAGE_KEY = "dc2d_audio_prefs_v1";
const DEFAULT_AUDIO_PREFS: AudioPrefs = { muted: false, music: 0.55, sfx: 0.75 };

const AudioPrefsSchema = z.object({
  muted: z.boolean().optional(),
  music: z.number().finite().min(0).max(1).optional(),
  sfx: z.number().finite().min(0).max(1).optional(),
});

export function loadAudioPrefs(): AudioPrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AUDIO_PREFS;
    const res = AudioPrefsSchema.safeParse(JSON.parse(raw));
    if (!res.success) return DEFAULT_AUDIO_PREFS;
    return {
      muted: res.data.muted ?? DEFAULT_AUDIO_PREFS.muted,
      music: res.data.music ?? DEFAULT_AUDIO_PREFS.music,
      sfx: res.data.sfx ?? DEFAULT_AUDIO_PREFS.sfx,
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
