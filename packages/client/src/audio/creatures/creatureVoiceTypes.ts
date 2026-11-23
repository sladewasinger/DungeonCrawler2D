/** Shared voice layer types, Wave/Filter constants, and compact layer builders for creature SFX. */
import type { CreatureVocalKind } from "@dc2d/engine";
import type { NoiseColor } from "../synthSfx.js";

export const CREATURE_VOICE_KINDS = [
  "bear", "boar", "wolf", "spider", "slime", "goblin", "orc", "skeleton", "golem",
] as const;

export const CREATURE_VOCAL_KINDS: readonly CreatureVocalKind[] = [
  "alert", "attack", "charge", "hurt", "death",
];

export type CreatureVoiceKind = (typeof CREATURE_VOICE_KINDS)[number];

export interface ToneVoiceLayer {
  readonly kind: "tone";
  readonly wave: OscillatorType;
  readonly f0: number;
  readonly f1: number;
  readonly dur: number;
  readonly gain: number;
  readonly delay?: number;
  readonly hold?: number;
}

export interface SweepVoiceLayer {
  readonly kind: "sweep";
  readonly f0: number;
  readonly f1: number;
  readonly filter: BiquadFilterType;
  readonly color: NoiseColor;
  readonly q: number;
  readonly atk: number;
  readonly dur: number;
  readonly gain: number;
  readonly delay?: number;
  readonly hold?: number;
}

export interface BurstVoiceLayer {
  readonly kind: "burst";
  readonly freq: number;
  readonly filter: BiquadFilterType;
  readonly color: NoiseColor;
  readonly q: number;
  readonly dur: number;
  readonly gain: number;
  readonly delay?: number;
  readonly hold?: number;
}

export type VoiceLayer = ToneVoiceLayer | SweepVoiceLayer | BurstVoiceLayer;
export type CreatureVocalSpec = readonly VoiceLayer[];
export type CreatureVoiceSet = Record<CreatureVocalKind, CreatureVocalSpec>;

export const W_SAW: OscillatorType = "sawtooth";
export const W_TRI: OscillatorType = "triangle";
export const W_SIN: OscillatorType = "sine";
export const F_BP: BiquadFilterType = "bandpass";
export const F_LP: BiquadFilterType = "lowpass";
export const F_HP: BiquadFilterType = "highpass";
export const C_BR: NoiseColor = "brown";
export const C_PK: NoiseColor = "pink";
export const C_WH: NoiseColor = "white";

const KIND_TONE: ToneVoiceLayer["kind"] = "tone";
const KIND_SWEEP: SweepVoiceLayer["kind"] = "sweep";
const KIND_BURST: BurstVoiceLayer["kind"] = "burst";

export function tone(opts: Omit<ToneVoiceLayer, "kind">): ToneVoiceLayer {
  return { kind: KIND_TONE, ...opts };
}

export function sweep(opts: Omit<SweepVoiceLayer, "kind">): SweepVoiceLayer {
  return { kind: KIND_SWEEP, ...opts };
}

export function burst(opts: Omit<BurstVoiceLayer, "kind">): BurstVoiceLayer {
  return { kind: KIND_BURST, ...opts };
}
