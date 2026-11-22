import { describe, expect, it } from "vitest";
import { STUDIO_PRESETS } from "./studioPresets.js";
import { mergePresetLibrary, tracksFingerprint, upsertSavedPreset } from "./studioStorage.js";
import { activeStudioTracks, computeTrackWindow } from "./studioSynth.js";
import type { SoundTrackSpec } from "./studioTypes.js";

function sampleTrack(overrides: Partial<SoundTrackSpec> = {}): SoundTrackSpec {
  return {
    id: "t1", name: "Swept", kind: "sweptNoise", wave: "sine", filterType: "lowpass",
    f0: 400, f1: 100, q: 0.7, delaySec: 0.1, durationSec: 0.2, attackSec: 0.02, gain: 0.25,
    enabled: true, solo: false, ...overrides,
  };
}

describe("soundStudio", () => {
  it("slices track windows accurately before, inside, and past the playhead", () => {
    const t = sampleTrack();
    const before = computeTrackWindow(t, 0.04);
    expect(before?.startDelaySec).toBeCloseTo(0.06, 5);
    expect(before?.durationSec).toBe(0.2);
    expect(before?.f0).toBe(400);
    const mid = computeTrackWindow(t, 0.2);
    expect(mid?.startDelaySec).toBe(0);
    expect(mid?.durationSec).toBeCloseTo(0.1, 4);
    expect(mid?.f0).toBeCloseTo(200, 1);
    expect(computeTrackWindow(t, 0.31)).toBeNull();
  });

  it("tracks dirty fingerprints and merges custom / overridden presets cleanly", () => {
    const base = STUDIO_PRESETS[0]!;
    const editedTracks = base.tracks.map((t, i) => (i === 0 ? { ...t, f0: 210 } : t));
    expect(tracksFingerprint(editedTracks)).not.toBe(tracksFingerprint(base.tracks));
    const saved = upsertSavedPreset([], { ...base, tracks: editedTracks });
    const withCustom = upsertSavedPreset(saved, { id: "custom-1", name: "My Bell", description: "Custom", tracks: editedTracks });
    const lib = mergePresetLibrary(STUDIO_PRESETS, withCustom);
    expect(lib[0]?.isOverride).toBe(true);
    expect(lib[0]?.tracks[0]?.f0).toBe(210);
    expect(lib.find((p) => p.id === "custom-1")?.isCustom).toBe(true);
  });

  it("preserves sequential single-field patches when toggling active/mute or solo", () => {
    let tracks = [sampleTrack({ id: "a", f0: 280 }), sampleTrack({ id: "b", f0: 680 })];
    const applyPatch = (id: string, patch: Partial<SoundTrackSpec>) => {
      tracks = tracks.map((t) => (t.id === id ? { ...t, ...patch } : t));
    };
    applyPatch("a", { f0: 145 });
    applyPatch("a", { gain: 0.52 });
    applyPatch("a", { enabled: false });
    expect(tracks[0]).toMatchObject({ f0: 145, gain: 0.52, enabled: false });
    expect(activeStudioTracks(tracks).map((t) => t.id)).toEqual(["b"]);
    applyPatch("a", { solo: true });
    expect(activeStudioTracks(tracks).map((t) => t.id)).toEqual(["a"]);
  });
});
