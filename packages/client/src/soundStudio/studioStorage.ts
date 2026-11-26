/** LocalStorage preset persistence, override merging, normalization, and dirty fingerprinting. */
import { z } from "zod";
import { normalizeTrackSpec } from "../audio/proceduralSynth.js";
import { STUDIO_PRESETS_STORAGE_KEY } from "../audio/studioOverrides.js";
import type { SoundPreset, SoundTrackSpec } from "./studioTypes.js";

const STORAGE_KEY = STUDIO_PRESETS_STORAGE_KEY;
const FORBIDDEN_IDS = new Set(["__proto__", "constructor", "prototype"]);

const StoredPresetSchema = z.object({
  id: z.string().min(1).max(64).refine((id) => !FORBIDDEN_IDS.has(id)),
  name: z.string().min(1).max(64),
  description: z.string().max(256).optional(),
  tracks: z.array(z.record(z.string(), z.unknown())).max(16),
});
const StoredPresetsArraySchema = z.array(StoredPresetSchema).max(64);

export interface LibraryPreset extends SoundPreset {
  readonly isCustom: boolean;
  readonly isOverride: boolean;
}

function canonicalTrack(t: SoundTrackSpec) {
  return {
    name: t.name, kind: t.kind, wave: t.wave, filterType: t.filterType, noiseColor: t.noiseColor,
    f0: Number(t.f0.toFixed(2)), f1: Number(t.f1.toFixed(2)), q: Number(t.q.toFixed(2)),
    delaySec: Number(t.delaySec.toFixed(4)), durationSec: Number(t.durationSec.toFixed(4)),
    attackSec: Number(t.attackSec.toFixed(4)), holdSec: Number(t.holdSec.toFixed(4)),
    gain: Number(t.gain.toFixed(3)), pan: Number(t.pan.toFixed(2)), enabled: t.enabled, solo: t.solo,
  };
}

export function tracksFingerprint(tracks: readonly SoundTrackSpec[]): string {
  return JSON.stringify(tracks.map(canonicalTrack));
}

export function loadSavedPresets(): SoundPreset[] {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw || raw.length > 262_144) return [];
    const parsed = StoredPresetsArraySchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return [];
    return parsed.data.map((p) => normalizeLoadedPreset({
      id: p.id, name: p.name, description: p.description ?? "", tracks: p.tracks as unknown as SoundTrackSpec[],
    }));
  } catch {
    return [];
  }
}

function persistSavedPresets(presets: readonly SoundPreset[]): void {
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

function removeSavedPreset(presets: readonly SoundPreset[], id: string): SoundPreset[] {
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

export function savePresetEntry(opts: {
  readonly saved: readonly SoundPreset[]; readonly builtIns: readonly SoundPreset[];
  readonly entry: SoundPreset;
}): { readonly saved: SoundPreset[]; readonly library: LibraryPreset[] } {
  const saved = upsertSavedPreset(opts.saved, opts.entry);
  persistSavedPresets(saved);
  return { saved, library: mergePresetLibrary(opts.builtIns, saved) };
}

export function resetOrDeleteEntry(opts: {
  readonly saved: readonly SoundPreset[]; readonly builtIns: readonly SoundPreset[];
  readonly activeId: string;
}): { readonly saved: SoundPreset[]; readonly library: LibraryPreset[]; readonly nextPreset: LibraryPreset } {
  const saved = removeSavedPreset(opts.saved, opts.activeId);
  persistSavedPresets(saved);
  const library = mergePresetLibrary(opts.builtIns, saved);
  const nextPreset = library.find((p) => p.id === opts.activeId) ?? library[0]!;
  return { saved, library, nextPreset };
}

function normalizeLoadedPreset(preset: SoundPreset): SoundPreset {
  const tracks = preset.tracks.map((t, i) => normalizeTrackSpec(t, `loaded-${i + 1}`));
  return { id: preset.id, name: preset.name, description: preset.description || "", tracks };
}
