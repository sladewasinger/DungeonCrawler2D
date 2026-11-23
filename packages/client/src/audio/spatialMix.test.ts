import { afterEach, describe, expect, it } from "vitest";
import { computeSpatialMix, SPATIAL_AUDIO_DEFAULTS } from "./spatialMix.js";
import {
  getSavedStudioPresetTracks, refreshStudioOverrides, STUDIO_PRESETS_STORAGE_KEY,
} from "./studioOverrides.js";
import {
  CREATURE_VOCAL_KINDS, CREATURE_VOICE_KINDS, getCreatureVoiceSpec, isWildlifeVoiceKind,
} from "./creatures/synthCreatureSfx.js";

describe("computeSpatialMix", () => {
  it("plays at full gain inside the near radius and centers pan when aligned", () => {
    const near = computeSpatialMix({ dx: 0, dy: 1.5 });
    expect(near.audible).toBe(true);
    expect(near.gain).toBe(1);
    expect(near.pan).toBe(0);
  });

  it("attenuates smoothly with distance and clamps stereo pan", () => {
    const midRight = computeSpatialMix({ dx: 12, dy: 0 });
    const farLeft = computeSpatialMix({ dx: -18, dy: 0 });
    expect(midRight.audible).toBe(true);
    expect(midRight.gain).toBeLessThan(1);
    expect(midRight.gain).toBeGreaterThan(farLeft.gain);
    expect(midRight.pan).toBe(SPATIAL_AUDIO_DEFAULTS.maxPan);
    expect(farLeft.pan).toBe(-SPATIAL_AUDIO_DEFAULTS.maxPan);
  });

  it("culls events at or beyond the max audible radius", () => {
    const edge = computeSpatialMix({ dx: SPATIAL_AUDIO_DEFAULTS.maxDistanceTiles, dy: 0 });
    const beyond = computeSpatialMix({ dx: 20, dy: 20 });
    expect(edge.audible).toBe(false);
    expect(edge.gain).toBe(0);
    expect(beyond.audible).toBe(false);
  });
});

describe("creature voice specs", () => {
  it("defines non-empty procedural layers for all 9 enemy and wildlife species across every vocal cue", () => {
    expect(CREATURE_VOICE_KINDS).toHaveLength(9);
    for (const kind of CREATURE_VOICE_KINDS) {
      expect(isWildlifeVoiceKind(kind)).toBe(true);
      for (const vocal of CREATURE_VOCAL_KINDS) {
        const layers = getCreatureVoiceSpec(kind, vocal);
        expect(layers.length).toBeGreaterThan(0);
      }
    }
    expect(isWildlifeVoiceKind("dummy")).toBe(false);
    for (const kind of ["bear", "boar"] as const) {
      for (const vocal of CREATURE_VOCAL_KINDS) {
        expect(getCreatureVoiceSpec(kind, vocal).some((l) => l.kind === "vocal")).toBe(true);
      }
    }
  });
});

const BOAR_CHARGE_ID = "creature-boar-charge";

describe("Sound Studio live overrides", () => {
  const origStorage = (globalThis as { localStorage?: Storage }).localStorage;

  afterEach(() => {
    if (origStorage === undefined) delete (globalThis as { localStorage?: Storage }).localStorage;
    else (globalThis as { localStorage?: Storage }).localStorage = origStorage;
    refreshStudioOverrides();
  });

  it("loads saved creature-boar-charge overrides from localStorage and clears cleanly", () => {
    const store = new Map<string, string>([
      [
        STUDIO_PRESETS_STORAGE_KEY,
        JSON.stringify([{ id: BOAR_CHARGE_ID, name: "Boar", tracks: [{ id: "v1", kind: "vocal", f0: 190, f1: 110, q: 6.5, durationSec: 0.3, gain: 0.4 }] }]),
      ],
    ]);
    (globalThis as { localStorage?: Pick<Storage, "getItem"> }).localStorage = { getItem: (k) => store.get(k) ?? null };
    refreshStudioOverrides();
    const tracks = getSavedStudioPresetTracks(BOAR_CHARGE_ID);
    expect(tracks).toHaveLength(1);
    expect(tracks?.[0]).toMatchObject({ kind: "vocal", f0: 190, gain: 0.4 });
    store.delete(STUDIO_PRESETS_STORAGE_KEY);
    refreshStudioOverrides();
    expect(getSavedStudioPresetTracks(BOAR_CHARGE_ID)).toBeUndefined();
  });
});
