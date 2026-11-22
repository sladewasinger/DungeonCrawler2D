/** LocalStorage preset persistence, override merging, and dirty-state fingerprinting. */
import type { SoundPreset, SoundTrackSpec } from "./studioTypes.js";

const STORAGE_KEY = "dc2d-sound-studio-presets-v1";

export interface LibraryPreset extends SoundPreset {
  readonly isCustom: boolean;
  readonly isOverride: boolean;
}

export function tracksFingerprint(tracks: readonly SoundTrackSpec[]): string {
  return JSON.stringify(
    tracks.map((t) => ({
      name: t.name, kind: t.kind, wave: t.wave, filterType: t.filterType,
      f0: Number(t.f0.toFixed(2)), f1: Number(t.f1.toFixed(2)), q: Number(t.q.toFixed(2)),
      delaySec: Number(t.delaySec.toFixed(4)), durationSec: Number(t.durationSec.toFixed(4)),
      attackSec: Number(t.attackSec.toFixed(4)), gain: Number(t.gain.toFixed(3)),
      enabled: t.enabled, solo: t.solo,
    })),
  );
}

export function loadSavedPresets(): SoundPreset[] {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isPresetShape) : [];
  } catch {
    return [];
  }
}

export function persistSavedPresets(presets: readonly SoundPreset[]): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    }
  } catch {
    // Ignore storage quota errors in restricted browsing modes.
  }
}

export function upsertSavedPreset(presets: readonly SoundPreset[], next: SoundPreset): SoundPreset[] {
  const idx = presets.findIndex((p) => p.id === next.id);
  const copy = [...presets];
  if (idx >= 0) copy[idx] = next;
  else copy.push(next);
  return copy;
}

export function removeSavedPreset(presets: readonly SoundPreset[], id: string): SoundPreset[] {
  return presets.filter((p) => p.id !== id);
}

export function mergePresetLibrary(builtIns: readonly SoundPreset[], saved: readonly SoundPreset[]): LibraryPreset[] {
  const savedMap = new Map(saved.map((p) => [p.id, p]));
  const builtInIds = new Set(builtIns.map((p) => p.id));
  const mergedBuiltIns: LibraryPreset[] = builtIns.map((base) => {
    const ov = savedMap.get(base.id);
    if (ov) return { ...ov, isCustom: false, isOverride: true };
    return { ...base, isCustom: false, isOverride: false };
  });
  const customOnly: LibraryPreset[] = saved
    .filter((p) => !builtInIds.has(p.id))
    .map((p) => ({ ...p, isCustom: true, isOverride: false }));
  return [...mergedBuiltIns, ...customOnly];
}

function isPresetShape(val: unknown): val is SoundPreset {
  if (!val || typeof val !== "object") return false;
  const obj = val as Record<string, unknown>;
  return typeof obj.id === "string" && typeof obj.name === "string" && Array.isArray(obj.tracks);
}
