import { describe, expect, it } from "vitest";
import { computeSpatialMix, SPATIAL_AUDIO_DEFAULTS } from "./spatialMix.js";
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
  });
});
