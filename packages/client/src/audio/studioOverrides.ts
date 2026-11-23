/** Live Sound Studio preset overrides stored in localStorage with cross-tab hot-reload. */
import { normalizeTrackSpec, playProceduralTracks, type ProceduralTrackSpec } from "./proceduralSynth.js";

export const STUDIO_PRESETS_STORAGE_KEY = "dc2d-sound-studio-presets-v1";

let overrideMap: Map<string, readonly ProceduralTrackSpec[]> | null = null;
let storageBound = false;

function bindStorageSync(): void {
  if (storageBound || typeof window === "undefined") return;
  storageBound = true;
  window.addEventListener("storage", (ev) => {
    if (ev.key === STUDIO_PRESETS_STORAGE_KEY || ev.key === null) refreshStudioOverrides();
  });
}

function registerOverrideEntry(out: Map<string, readonly ProceduralTrackSpec[]>, entry: unknown): void {
  if (!entry || typeof entry !== "object") return;
  const rec = entry as { readonly id?: unknown; readonly tracks?: unknown };
  if (typeof rec.id !== "string" || !rec.id || !Array.isArray(rec.tracks)) return;
  const tracks = rec.tracks.map((raw, i) =>
    normalizeTrackSpec((raw ?? {}) as Partial<ProceduralTrackSpec>, `${rec.id}-${i + 1}`),
  );
  out.set(rec.id, tracks);
}

function parseOverridesFromStorage(): Map<string, readonly ProceduralTrackSpec[]> {
  const out = new Map<string, readonly ProceduralTrackSpec[]>();
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STUDIO_PRESETS_STORAGE_KEY) : null;
    if (!raw) return out;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return out;
    for (const entry of parsed) registerOverrideEntry(out, entry);
  } catch {
    // Ignore storage access or malformed JSON errors.
  }
  return out;
}

export function refreshStudioOverrides(): void {
  overrideMap = parseOverridesFromStorage();
}

export function getSavedStudioPresetTracks(presetId: string): readonly ProceduralTrackSpec[] | undefined {
  bindStorageSync();
  overrideMap ??= parseOverridesFromStorage();
  return overrideMap.get(presetId);
}

function scaleOverrideTrack(t: ProceduralTrackSpec, opts: {
  readonly gainScale: number; readonly delaySec: number; readonly pitch: number;
}): ProceduralTrackSpec {
  return {
    ...t,
    gain: Math.max(0.002, Math.min(1, t.gain * opts.gainScale)),
    delaySec: Math.max(0, t.delaySec + opts.delaySec),
    f0: Math.max(20, Math.min(10000, t.f0 * opts.pitch)),
    f1: Math.max(20, Math.min(10000, t.f1 * opts.pitch)),
  };
}

export function playSavedStudioPreset(opts: {
  readonly ctx: AudioContext;
  readonly dst: AudioNode;
  readonly presetId: string;
  readonly gainScale?: number | undefined;
  readonly delaySec?: number | undefined;
  readonly pitchJitter?: number | undefined;
}): boolean {
  const tracks = getSavedStudioPresetTracks(opts.presetId);
  if (!tracks || tracks.length === 0) return false;
  const jitter = opts.pitchJitter ?? 0;
  const pitch = jitter > 0 ? 1 + (Math.random() * 2 - 1) * jitter : 1;
  const gainScale = opts.gainScale ?? 1;
  const delaySec = opts.delaySec ?? 0;
  const scaled = tracks.map((t) => scaleOverrideTrack(t, { gainScale, delaySec, pitch }));
  playProceduralTracks({ ctx: opts.ctx, dst: opts.dst, tracks: scaled });
  return true;
}
