/** Data contracts for multi-track procedural sound synthesis in Sound Studio. */
import type { NoiseColor, ProceduralTrackKind, ProceduralTrackSpec } from "../audio/proceduralSynth.js";

export type { NoiseColor };
export type TrackKind = ProceduralTrackKind;
export type SoundTrackSpec = ProceduralTrackSpec;

export interface SoundPreset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly tracks: readonly SoundTrackSpec[];
}

export function createDefaultTrack(kind: TrackKind, index: number): SoundTrackSpec {
  const id = `trk-${Date.now()}-${index}`;
  if (kind === "tone") {
    return {
      id, name: `Tone Layer ${index}`, kind, wave: "sine", filterType: "lowpass", noiseColor: "white",
      f0: 440, f1: 660, q: 1.0, delaySec: 0, durationSec: 0.14, attackSec: 0.012, holdSec: 0, gain: 0.16, pan: 0,
      enabled: true, solo: false,
    };
  }
  if (kind === "sweptNoise") {
    return {
      id, name: `Swept Noise ${index}`, kind, wave: "sine", filterType: "bandpass", noiseColor: "white",
      f0: 450, f1: 1200, q: 1.2, delaySec: 0, durationSec: 0.22, attackSec: 0.03, holdSec: 0, gain: 0.2, pan: 0,
      enabled: true, solo: false,
    };
  }
  return {
    id, name: `Noise Burst ${index}`, kind, wave: "sine", filterType: "bandpass", noiseColor: "white",
    f0: 950, f1: 950, q: 1.1, delaySec: 0, durationSec: 0.08, attackSec: 0.012, holdSec: 0, gain: 0.14, pan: 0,
    enabled: true, solo: false,
  };
}
