/** Data contracts for multi-track procedural sound synthesis in Sound Studio. */

export type TrackKind = "noise" | "sweptNoise" | "tone";

export interface SoundTrackSpec {
  readonly id: string;
  readonly name: string;
  readonly kind: TrackKind;
  readonly wave: OscillatorType;
  readonly filterType: BiquadFilterType;
  readonly f0: number;
  readonly f1: number;
  readonly q: number;
  readonly delaySec: number;
  readonly durationSec: number;
  readonly attackSec: number;
  readonly gain: number;
  readonly enabled: boolean;
  readonly solo: boolean;
}

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
      id, name: `Tone Layer ${index}`, kind, wave: "sine", filterType: "lowpass",
      f0: 440, f1: 660, q: 1.0, delaySec: 0, durationSec: 0.14, attackSec: 0.012, gain: 0.16, enabled: true, solo: false,
    };
  }
  if (kind === "sweptNoise") {
    return {
      id, name: `Swept Noise ${index}`, kind, wave: "sine", filterType: "bandpass",
      f0: 450, f1: 1200, q: 1.2, delaySec: 0, durationSec: 0.22, attackSec: 0.03, gain: 0.2, enabled: true, solo: false,
    };
  }
  return {
    id, name: `Noise Burst ${index}`, kind, wave: "sine", filterType: "bandpass",
    f0: 950, f1: 950, q: 1.1, delaySec: 0, durationSec: 0.08, attackSec: 0.012, gain: 0.14, enabled: true, solo: false,
  };
}
