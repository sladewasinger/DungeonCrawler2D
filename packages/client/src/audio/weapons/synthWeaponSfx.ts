/** Per-weapon synthesized melee swing sound effects across Sword, Axe, Pickaxe, Torch, and extended archetypes. */
import type { WeaponArchetype } from "@dc2d/engine";
import { AUDIO_TUNING } from "../audioTuning.js";
import { playNoiseBurst, playSweptNoise, playTone } from "../synthSfx.js";

const SWORD_SYNTH = (ctx: AudioContext, dst: AudioNode, comboStep: number): void => {
  const g = AUDIO_TUNING.combat.swingGain;
  const pitch = 1 + (comboStep - 1) * 0.14;
  playNoiseBurst({ ctx, dst, duration: 0.14, freq: 1350 * pitch, filterType: "bandpass", gain: g, q: 1.8 });
  playTone({ ctx, dst, wave: "triangle", f0: 290 * pitch, f1: 120, duration: 0.1, gain: g * 0.55 });
  if (comboStep === 3) {
    playSweptNoise({ ctx, dst, duration: 0.16, f0: 1700, f1: 2650, filterType: "highpass", gain: g * 0.65, q: 1.6, attackSec: 0.012 });
  }
};

const WEAPON_SYNTH_MAP: Partial<Record<WeaponArchetype, (ctx: AudioContext, dst: AudioNode, step: number) => void>> = {
  sword: SWORD_SYNTH,
  axe: (ctx, dst) => {
    const g = AUDIO_TUNING.combat.swingGain;
    playSweptNoise({ ctx, dst, duration: 0.22, f0: 640, f1: 240, filterType: "bandpass", gain: g * 1.15, q: 1.2, attackSec: 0.02, noiseColor: "pink" });
    playTone({ ctx, dst, wave: "triangle", f0: 190, f1: 68, duration: 0.16, gain: g * 0.72 });
  },
  pickaxe: (ctx, dst) => {
    const g = AUDIO_TUNING.combat.swingGain;
    playSweptNoise({ ctx, dst, duration: 0.12, f0: 780, f1: 1450, filterType: "bandpass", gain: g * 0.85, q: 1.4, attackSec: 0.01 });
    playTone({ ctx, dst, wave: "triangle", f0: 210, f1: 64, duration: 0.14, gain: g * 0.78, delay: 0.14 });
    playTone({ ctx, dst, wave: "sine", f0: 1280, f1: 780, duration: 0.09, gain: g * 0.35, delay: 0.14 });
  },
  torch: (ctx, dst, step) => {
    const g = AUDIO_TUNING.combat.swingGain;
    playSweptNoise({ ctx, dst, duration: 0.16, f0: 920, f1: step === 2 ? 2150 : 1700, filterType: "bandpass", gain: g * 1.05, q: 1.4, attackSec: 0.015 });
    playNoiseBurst({ ctx, dst, duration: 0.09, freq: 2800, filterType: "highpass", gain: g * 0.42, delay: 0.04 });
  },
  unarmed: (ctx, dst, step) => {
    const g = AUDIO_TUNING.combat.swingGain;
    const pitch = step === 2 ? 1.12 : 1.0;
    playSweptNoise({ ctx, dst, duration: 0.08, f0: 480 * pitch, f1: 240, filterType: "bandpass", gain: g * 0.78, q: 1.3, attackSec: 0.008 });
    playTone({ ctx, dst, wave: "triangle", f0: 150 * pitch, f1: 68, duration: 0.075, gain: g * 0.58 });
  },
  dagger: (ctx, dst) => {
    const g = AUDIO_TUNING.combat.swingGain;
    playSweptNoise({ ctx, dst, duration: 0.09, f0: 2200, f1: 1300, filterType: "bandpass", gain: g * 0.88, q: 2.2, attackSec: 0.008 });
    playTone({ ctx, dst, wave: "triangle", f0: 420, f1: 180, duration: 0.07, gain: g * 0.45 });
  },
  spear: (ctx, dst) => {
    const g = AUDIO_TUNING.combat.swingGain;
    playSweptNoise({ ctx, dst, duration: 0.14, f0: 1650, f1: 2450, filterType: "bandpass", gain: g * 0.96, q: 1.8, attackSec: 0.01 });
    playTone({ ctx, dst, wave: "sine", f0: 520, f1: 210, duration: 0.11, gain: g * 0.5 });
  },
  greatsword: (ctx, dst) => {
    const g = AUDIO_TUNING.combat.swingGain;
    playSweptNoise({ ctx, dst, duration: 0.26, f0: 480, f1: 185, filterType: "bandpass", gain: g * 1.25, q: 1.1, attackSec: 0.025, noiseColor: "pink" });
    playTone({ ctx, dst, wave: "triangle", f0: 145, f1: 56, duration: 0.20, gain: g * 0.82 });
  },
};

export function synthWeaponSwingByArchetype(opts: {
  readonly ctx: AudioContext;
  readonly dst: AudioNode;
  readonly comboStep: number;
  readonly archetype: WeaponArchetype;
}): void {
  const fn = WEAPON_SYNTH_MAP[opts.archetype] ?? SWORD_SYNTH;
  fn(opts.ctx, opts.dst, opts.comboStep);
}

export type HarvestSfxFamily = "wood" | "stone" | "ore" | "forage";

export interface HarvestSfxSpec {
  readonly family: HarvestSfxFamily;
  readonly toneWave: OscillatorType;
  readonly toneF0: number;
  readonly toneF1: number;
  readonly toneDur: number;
  readonly toneGain: number;
  readonly noiseFreq: number;
  readonly filterType: BiquadFilterType;
  readonly noiseDur: number;
  readonly noiseGain: number;
  readonly pingF0?: number | undefined;
}

const HARVEST_SFX_SPECS: Readonly<Record<HarvestSfxFamily, HarvestSfxSpec>> = {
  wood: { family: "wood", toneWave: "triangle", toneF0: 230, toneF1: 72, toneDur: 0.14, toneGain: 0.18, noiseFreq: 620, filterType: "lowpass", noiseDur: 0.10, noiseGain: 0.14 },
  stone: { family: "stone", toneWave: "sine", toneF0: 1580, toneF1: 880, toneDur: 0.12, toneGain: 0.15, noiseFreq: 1750, filterType: "bandpass", noiseDur: 0.10, noiseGain: 0.14 },
  ore: { family: "ore", toneWave: "sine", toneF0: 2350, toneF1: 1520, toneDur: 0.17, toneGain: 0.17, noiseFreq: 2600, filterType: "bandpass", noiseDur: 0.11, noiseGain: 0.12, pingF0: 3180 },
  forage: { family: "forage", toneWave: "sine", toneF0: 540, toneF1: 820, toneDur: 0.08, toneGain: 0.11, noiseFreq: 2400, filterType: "highpass", noiseDur: 0.12, noiseGain: 0.15 },
};

export function buildHarvestSfxSpec(family: HarvestSfxFamily, broken = false): HarvestSfxSpec {
  const base = HARVEST_SFX_SPECS[family];
  return broken ? { ...base, toneDur: base.toneDur * 1.45, noiseDur: base.noiseDur * 1.5, toneGain: base.toneGain * 1.15 } : base;
}

export function renderHarvestSfxSamples(family: HarvestSfxFamily, broken = false, sampleRate = 24000): Float32Array {
  const spec = buildHarvestSfxSpec(family, broken);
  const len = Math.max(64, Math.round(sampleRate * Math.max(spec.toneDur, spec.noiseDur)));
  const out = new Float32Array(len);
  let phase = 0;
  let noiseState = 1337;
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    const pTone = Math.min(1, t / spec.toneDur);
    const freq = spec.toneF0 + (spec.toneF1 - spec.toneF0) * pTone;
    phase += (2 * Math.PI * freq) / sampleRate;
    const toneEnv = Math.max(0, 1 - pTone);
    const wave = spec.toneWave === "triangle" ? (2 / Math.PI) * Math.asin(Math.sin(phase)) : Math.sin(phase);
    noiseState = (noiseState * 1664525 + 1013904223) >>> 0;
    const nSample = ((noiseState / 0xffffffff) * 2 - 1) * Math.max(0, 1 - t / spec.noiseDur) * spec.noiseGain;
    const ping = spec.pingF0 ? Math.sin(2 * Math.PI * spec.pingF0 * t) * toneEnv * 0.08 : 0;
    out[i] = Math.max(-0.98, Math.min(0.98, wave * spec.toneGain * toneEnv + nSample + ping));
  }
  return out;
}

export function synthHarvestSfx(opts: {
  readonly ctx: AudioContext; readonly dst: AudioNode; readonly family?: HarvestSfxFamily | undefined;
  readonly stone?: boolean | undefined; readonly broken: boolean; readonly clinkOnly?: boolean | undefined;
}): void {
  if (opts.clinkOnly) {
    playTone({ ctx: opts.ctx, dst: opts.dst, wave: "triangle", f0: 920, f1: 580, duration: 0.09, gain: 0.14 });
    return;
  }
  const family: HarvestSfxFamily = opts.family ?? (opts.stone ? "stone" : "wood");
  const spec = buildHarvestSfxSpec(family, opts.broken);
  playTone({ ctx: opts.ctx, dst: opts.dst, wave: spec.toneWave, f0: spec.toneF0, f1: spec.toneF1, duration: spec.toneDur, gain: spec.toneGain });
  playNoiseBurst({ ctx: opts.ctx, dst: opts.dst, duration: spec.noiseDur, freq: spec.noiseFreq, filterType: spec.filterType, gain: spec.noiseGain, q: 1.8 });
  if (spec.pingF0) playTone({ ctx: opts.ctx, dst: opts.dst, wave: "sine", f0: spec.pingF0, f1: spec.pingF0 * 0.78, duration: 0.14, gain: 0.09 });
}

export function synthDismantleSfx(ctx: AudioContext, dst: AudioNode): void {
  playTone({ ctx, dst, wave: "triangle", f0: 260, f1: 110, duration: 0.11, gain: 0.16 });
  playNoiseBurst({ ctx, dst, duration: 0.12, freq: 880, filterType: "bandpass", gain: 0.14, q: 1.4 });
}
