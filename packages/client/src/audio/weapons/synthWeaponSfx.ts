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

function playStoneHarvest(ctx: AudioContext, dst: AudioNode, broken: boolean): void {
  playTone({ ctx, dst, wave: "sine", f0: broken ? 1480 : 1820, f1: 940, duration: 0.14, gain: 0.16 });
  playNoiseBurst({ ctx, dst, duration: broken ? 0.22 : 0.1, freq: 1650, filterType: "bandpass", gain: 0.14, q: 1.8 });
}

function playWoodHarvest(ctx: AudioContext, dst: AudioNode, broken: boolean): void {
  playTone({ ctx, dst, wave: "triangle", f0: broken ? 190 : 240, f1: 72, duration: broken ? 0.22 : 0.12, gain: 0.18 });
  playNoiseBurst({ ctx, dst, duration: broken ? 0.24 : 0.09, freq: 620, filterType: "lowpass", gain: 0.14 });
}

export function synthHarvestSfx(opts: {
  readonly ctx: AudioContext; readonly dst: AudioNode; readonly stone: boolean; readonly broken: boolean;
}): void {
  if (opts.stone) playStoneHarvest(opts.ctx, opts.dst, opts.broken);
  else playWoodHarvest(opts.ctx, opts.dst, opts.broken);
}
