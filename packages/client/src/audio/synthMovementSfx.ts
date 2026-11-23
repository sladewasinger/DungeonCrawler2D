/** Procedural surface footsteps, layered water splash/plunge, and heavy dirt landing SFX. */
import { GroundKind } from "@dc2d/engine";
import { AUDIO_TUNING } from "./audioTuning.js";
import { playSavedStudioPreset } from "./studioOverrides.js";
import { playNoiseBurst, playSweptNoise, playTone } from "./synthSfx.js";

const FILTER_LP: BiquadFilterType = "lowpass";
const FILTER_BP: BiquadFilterType = "bandpass";
const WAVE_SINE: OscillatorType = "sine";

const STEP_SPECS: Readonly<Record<number, { readonly freq: number; readonly q: number; readonly dur: number; readonly gain: number }>> = {
  [GroundKind.ShallowWater]: { freq: 720, q: 0.7, dur: 0.14, gain: 0.16 },
  [GroundKind.CliffStone]: { freq: 1450, q: 1.8, dur: 0.06, gain: 0.12 },
  [GroundKind.MossStone]: { freq: 1200, q: 1.5, dur: 0.07, gain: 0.11 },
  [GroundKind.DirtPath]: { freq: 920, q: 1.2, dur: 0.075, gain: 0.1 },
  [GroundKind.Sand]: { freq: 1100, q: 0.9, dur: 0.08, gain: 0.09 },
};

function synthWaterSplash(ctx: AudioContext, dst: AudioNode, sprinting: boolean): void {
  if (playSavedStudioPreset({ ctx, dst, presetId: "water-step", gainScale: sprinting ? 1.0 : 0.76, pitchJitter: 0.06 })) return;
  const ft = AUDIO_TUNING.footsteps;
  const g = sprinting ? 1.0 : 0.76;
  playSweptNoise({
    ctx, dst, duration: 0.19, f0: 300 + Math.random() * 80, f1: ft.waterSplashFreqHz * 1.3,
    filterType: FILTER_BP, gain: ft.waterSplashGain * g, q: 1.35, attackSec: 0.045,
  });
  playSweptNoise({
    ctx, dst, duration: 0.24, f0: 1250 + Math.random() * 250, f1: 340,
    filterType: FILTER_LP, gain: ft.waterSplashGain * 0.72 * g, q: 0.9, attackSec: 0.04, delay: 0.05,
  });
  playTone({
    ctx, dst, wave: WAVE_SINE, f0: 360 + Math.random() * 80, f1: 680 + Math.random() * 120,
    duration: 0.042, gain: ft.waterDropletGain * 0.34 * g, delay: 0.075,
  });
  playTone({
    ctx, dst, wave: WAVE_SINE, f0: 520 + Math.random() * 120, f1: 920 + Math.random() * 200,
    duration: 0.038, gain: ft.waterDropletGain * 0.26 * g, delay: 0.145,
  });
}

export function synthFootstep(opts: {
  readonly ctx: AudioContext; readonly dst: AudioNode; readonly ground: GroundKind; readonly sprinting?: boolean | undefined;
}): void {
  const { ctx, dst, ground } = opts;
  const sprinting = Boolean(opts.sprinting);
  if (ground === GroundKind.ShallowWater || ground === GroundKind.DeepWater) {
    synthWaterSplash(ctx, dst, sprinting);
    return;
  }
  const ft = AUDIO_TUNING.footsteps;
  const spec = STEP_SPECS[ground] ?? { freq: 620, q: 0.85, dur: 0.07, gain: 0.085 };
  const bodyGain = spec.gain * ft.masterGain * (sprinting ? 1.0 : 0.72);
  const freq = spec.freq * ft.pitchScale * (sprinting ? 1.06 : 0.92) * (0.9 + Math.random() * 0.2);
  playNoiseBurst({ ctx, dst, duration: spec.dur * 1.1, freq, filterType: FILTER_LP, gain: bodyGain, q: 0.65 });
  playNoiseBurst({
    ctx, dst, duration: 0.032,
    freq: ft.crunchFreqHz * (0.85 + Math.random() * 0.3),
    filterType: FILTER_BP, gain: bodyGain * ft.crunchMix, q: 0.85,
  });
}

function synthWaterJumpLand(ctx: AudioContext, dst: AudioNode, landing: boolean): void {
  const ft = AUDIO_TUNING.footsteps;
  if (!landing) {
    playTone({ ctx, dst, wave: WAVE_SINE, f0: 210, f1: 370, duration: 0.09, gain: 0.09 });
    playSweptNoise({
      ctx, dst, duration: 0.16, f0: 420, f1: 1300,
      filterType: FILTER_BP, gain: ft.waterSplashGain * 0.85, q: 1.2, attackSec: 0.035,
    });
    return;
  }
  if (landing && playSavedStudioPreset({ ctx, dst, presetId: "water-plunge", pitchJitter: 0.05 })) return;
  const big = ft.waterSplashGain * AUDIO_TUNING.landing.waterSplashMult;
  playTone({ ctx, dst, wave: WAVE_SINE, f0: 115, f1: 45, duration: 0.15, gain: 0.18 });
  playSweptNoise({
    ctx, dst, duration: 0.26, f0: 220, f1: ft.waterSplashFreqHz * 1.1,
    filterType: FILTER_BP, gain: big, q: 1.15, attackSec: 0.04,
  });
  playSweptNoise({
    ctx, dst, duration: 0.34, f0: 1500, f1: 260,
    filterType: FILTER_LP, gain: big * 0.85, q: 0.85, attackSec: 0.045, delay: 0.06,
  });
  playTone({ ctx, dst, wave: WAVE_SINE, f0: 360, f1: 700, duration: 0.045, gain: ft.waterDropletGain * 0.42, delay: 0.09 });
  playTone({ ctx, dst, wave: WAVE_SINE, f0: 510, f1: 960, duration: 0.04, gain: ft.waterDropletGain * 0.35, delay: 0.16 });
  playTone({ ctx, dst, wave: WAVE_SINE, f0: 660, f1: 1220, duration: 0.038, gain: ft.waterDropletGain * 0.28, delay: 0.24 });
}

function synthLandCrunch(ctx: AudioContext, dst: AudioNode): void {
  if (playSavedStudioPreset({ ctx, dst, presetId: "dirt-land", pitchJitter: 0.06 })) return;
  const ld = AUDIO_TUNING.landing;
  playSweptNoise({ ctx, dst, duration: ld.thudDurationSec, f0: ld.thudStartHz, f1: ld.thudEndHz, filterType: FILTER_LP, gain: ld.thudGain * 1.35, q: ld.thudQ, attackSec: 0.012 });
  playSweptNoise({ ctx, dst, delay: ld.dirtDelaySec, duration: ld.dirtDurationSec, f0: ld.dirtStartHz, f1: ld.dirtEndHz, filterType: FILTER_LP, gain: ld.dirtGain * 1.15, q: ld.dirtQ, attackSec: 0.028 });
  const clods = [
    { delay: 0.045, duration: 0.085, freq: 620 + Math.random() * 140, q: 0.75, mult: 0.85 },
    { delay: 0.11, duration: 0.095, freq: 470 + Math.random() * 120, q: 0.8, mult: 0.6 },
    { delay: 0.18, duration: 0.09, freq: 350 + Math.random() * 100, q: 0.8, mult: 0.38 },
  ];
  for (const c of clods) {
    playNoiseBurst({ ctx, dst, delay: c.delay * ld.clodSpreadScale, duration: c.duration, freq: c.freq * ld.clodFreqScale, filterType: FILTER_BP, gain: ld.dirtGain * ld.clodGainScale * c.mult, q: c.q });
  }
}

export function synthJumpOrLand(opts: {
  readonly ctx: AudioContext; readonly dst: AudioNode; readonly landing: boolean; readonly inWater: boolean;
}): void {
  const { ctx, dst, landing, inWater } = opts;
  if (inWater) { synthWaterJumpLand(ctx, dst, landing); return; }
  if (landing) { synthLandCrunch(ctx, dst); return; }
  playTone({ ctx, dst, wave: WAVE_SINE, f0: 210, f1: 370, duration: 0.09, gain: 0.1 });
}
