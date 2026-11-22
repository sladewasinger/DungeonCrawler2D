/** Procedural Web Audio API SFX synthesis with shared noise/tone envelope builders. */
import { GroundKind, type GoreSubstance } from "@dc2d/engine";
import { AUDIO_TUNING } from "./audioTuning.js";

interface NoiseBurstOpts {
  readonly ctx: AudioContext;
  readonly dst: AudioNode;
  readonly duration: number;
  readonly freq: number;
  readonly filterType: BiquadFilterType;
  readonly gain: number;
  readonly q?: number;
  readonly delay?: number;
}

interface ToneOpts {
  readonly ctx: AudioContext;
  readonly dst: AudioNode;
  readonly wave: OscillatorType;
  readonly f0: number;
  readonly f1: number;
  readonly duration: number;
  readonly gain: number;
  readonly delay?: number;
}

let cachedNoiseBuf: AudioBuffer | null = null;

export function getSharedNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (cachedNoiseBuf && cachedNoiseBuf.sampleRate === ctx.sampleRate) return cachedNoiseBuf;
  const len = Math.floor(ctx.sampleRate * 1.2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  cachedNoiseBuf = buf;
  return buf;
}

export function playNoiseBurst(opts: NoiseBurstOpts): void {
  const { ctx, dst, duration } = opts;
  const src = ctx.createBufferSource();
  src.buffer = getSharedNoiseBuffer(ctx);
  src.playbackRate.value = 0.92 + Math.random() * 0.16;
  const filter = ctx.createBiquadFilter();
  filter.type = opts.filterType;
  filter.frequency.value = opts.freq;
  filter.Q.value = opts.q ?? 1.2;
  const g = ctx.createGain();
  const now = ctx.currentTime + (opts.delay ?? 0);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.linearRampToValueAtTime(opts.gain, now + Math.min(0.014, duration * 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  src.connect(filter).connect(g).connect(dst);
  src.start(now, Math.random() * 0.4, duration + 0.02);
}

export function playTone(opts: ToneOpts): void {
  const { ctx, dst, duration } = opts;
  const now = ctx.currentTime + (opts.delay ?? 0);
  const osc = ctx.createOscillator();
  osc.type = opts.wave;
  osc.frequency.setValueAtTime(opts.f0, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, opts.f1), now + duration);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.linearRampToValueAtTime(opts.gain, now + Math.min(0.012, duration * 0.25));
  g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(g).connect(dst);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

const STEP_SPECS: Readonly<Record<number, { readonly freq: number; readonly q: number; readonly dur: number; readonly gain: number }>> = {
  [GroundKind.ShallowWater]: { freq: 720, q: 0.7, dur: 0.14, gain: 0.16 },
  [GroundKind.CliffStone]: { freq: 1450, q: 1.8, dur: 0.06, gain: 0.12 },
  [GroundKind.MossStone]: { freq: 1200, q: 1.5, dur: 0.07, gain: 0.11 },
  [GroundKind.DirtPath]: { freq: 920, q: 1.2, dur: 0.075, gain: 0.1 },
  [GroundKind.Sand]: { freq: 1100, q: 0.9, dur: 0.08, gain: 0.09 },
};

interface SweptNoiseOpts {
  readonly ctx: AudioContext;
  readonly dst: AudioNode;
  readonly duration: number;
  readonly f0: number;
  readonly f1: number;
  readonly filterType: BiquadFilterType;
  readonly gain: number;
  readonly q: number;
  readonly attackSec: number;
  readonly delay?: number;
}

function playSweptNoise(opts: SweptNoiseOpts): void {
  const { ctx, dst, duration } = opts;
  const now = ctx.currentTime + (opts.delay ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = getSharedNoiseBuffer(ctx);
  src.playbackRate.value = 0.88 + Math.random() * 0.24;
  const filter = ctx.createBiquadFilter();
  filter.type = opts.filterType;
  filter.Q.value = opts.q;
  filter.frequency.setValueAtTime(opts.f0, now);
  filter.frequency.exponentialRampToValueAtTime(Math.max(80, opts.f1), now + duration);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.linearRampToValueAtTime(opts.gain, now + opts.attackSec);
  g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  src.connect(filter).connect(g).connect(dst);
  src.start(now, Math.random() * 0.5, duration + 0.03);
}

function synthWaterSplash(ctx: AudioContext, dst: AudioNode): void {
  const ft = AUDIO_TUNING.footsteps;
  playSweptNoise({
    ctx, dst, duration: 0.19, f0: 300 + Math.random() * 80, f1: ft.waterSplashFreqHz * 1.3,
    filterType: "bandpass", gain: ft.waterSplashGain, q: 1.35, attackSec: 0.045,
  });
  playSweptNoise({
    ctx, dst, duration: 0.24, f0: 1250 + Math.random() * 250, f1: 340,
    filterType: "lowpass", gain: ft.waterSplashGain * 0.72, q: 0.9, attackSec: 0.04, delay: 0.05,
  });
  playTone({
    ctx, dst, wave: "sine", f0: 360 + Math.random() * 80, f1: 680 + Math.random() * 120,
    duration: 0.042, gain: ft.waterDropletGain * 0.34, delay: 0.075,
  });
  playTone({
    ctx, dst, wave: "sine", f0: 520 + Math.random() * 120, f1: 920 + Math.random() * 200,
    duration: 0.038, gain: ft.waterDropletGain * 0.26, delay: 0.145,
  });
}

export function synthFootstep(ctx: AudioContext, dst: AudioNode, ground: GroundKind): void {
  if (ground === GroundKind.ShallowWater || ground === GroundKind.DeepWater) {
    synthWaterSplash(ctx, dst);
    return;
  }
  const ft = AUDIO_TUNING.footsteps;
  const spec = STEP_SPECS[ground] ?? { freq: 620, q: 0.85, dur: 0.07, gain: 0.085 };
  const bodyGain = spec.gain * ft.masterGain;
  const freq = spec.freq * ft.pitchScale * (0.9 + Math.random() * 0.2);
  playNoiseBurst({ ctx, dst, duration: spec.dur * 1.1, freq, filterType: "lowpass", gain: bodyGain, q: 0.65 });
  playNoiseBurst({
    ctx, dst, duration: 0.032,
    freq: ft.crunchFreqHz * (0.85 + Math.random() * 0.3),
    filterType: "bandpass", gain: bodyGain * ft.crunchMix, q: 0.85,
  });
}

function synthWaterJumpLand(ctx: AudioContext, dst: AudioNode, landing: boolean): void {
  const ft = AUDIO_TUNING.footsteps;
  if (!landing) {
    playTone({ ctx, dst, wave: "sine", f0: 210, f1: 370, duration: 0.09, gain: 0.09 });
    playSweptNoise({
      ctx, dst, duration: 0.16, f0: 420, f1: 1300,
      filterType: "bandpass", gain: ft.waterSplashGain * 0.85, q: 1.2, attackSec: 0.035,
    });
    return;
  }
  const big = ft.waterSplashGain * ft.waterLandSplashMult;
  playTone({ ctx, dst, wave: "sine", f0: 115, f1: 45, duration: 0.15, gain: 0.18 });
  playSweptNoise({
    ctx, dst, duration: 0.26, f0: 220, f1: ft.waterSplashFreqHz * 1.1,
    filterType: "bandpass", gain: big, q: 1.15, attackSec: 0.04,
  });
  playSweptNoise({
    ctx, dst, duration: 0.34, f0: 1500, f1: 260,
    filterType: "lowpass", gain: big * 0.85, q: 0.85, attackSec: 0.045, delay: 0.06,
  });
  playTone({ ctx, dst, wave: "sine", f0: 360, f1: 700, duration: 0.045, gain: ft.waterDropletGain * 0.42, delay: 0.09 });
  playTone({ ctx, dst, wave: "sine", f0: 510, f1: 960, duration: 0.04, gain: ft.waterDropletGain * 0.35, delay: 0.16 });
  playTone({ ctx, dst, wave: "sine", f0: 660, f1: 1220, duration: 0.038, gain: ft.waterDropletGain * 0.28, delay: 0.24 });
}

function synthLandCrunch(ctx: AudioContext, dst: AudioNode): void {
  const ft = AUDIO_TUNING.footsteps;
  playSweptNoise({ ctx, dst, duration: 0.24, f0: 280, f1: 75, filterType: "lowpass", gain: ft.landThudGain * 1.35, q: 0.55, attackSec: 0.012 });
  playSweptNoise({ ctx, dst, delay: 0.012, duration: 0.23, f0: 680, f1: 210, filterType: "lowpass", gain: ft.landCrunchGain * 1.15, q: 0.65, attackSec: 0.028 });
  const clods = [
    { delay: 0.045, duration: 0.085, freq: 620 + Math.random() * 140, q: 0.75, mult: 0.85 },
    { delay: 0.11, duration: 0.095, freq: 470 + Math.random() * 120, q: 0.8, mult: 0.6 },
    { delay: 0.18, duration: 0.09, freq: 350 + Math.random() * 100, q: 0.8, mult: 0.38 },
  ];
  for (const c of clods) {
    playNoiseBurst({ ctx, dst, delay: c.delay, duration: c.duration, freq: c.freq, filterType: "bandpass", gain: ft.landCrunchGain * c.mult, q: c.q });
  }
}

export function synthJumpOrLand(opts: {
  readonly ctx: AudioContext;
  readonly dst: AudioNode;
  readonly landing: boolean;
  readonly inWater: boolean;
}): void {
  const { ctx, dst, landing, inWater } = opts;
  if (inWater) { synthWaterJumpLand(ctx, dst, landing); return; }
  if (landing) { synthLandCrunch(ctx, dst); return; }
  playTone({ ctx, dst, wave: "sine", f0: 210, f1: 370, duration: 0.09, gain: 0.1 });
}

export function synthSwing(ctx: AudioContext, dst: AudioNode, comboStep: number): void {
  const pitch = 1 + (comboStep - 1) * 0.14;
  playNoiseBurst({ ctx, dst, duration: 0.14, freq: 1350 * pitch, filterType: "bandpass", gain: AUDIO_TUNING.combat.swingGain, q: 1.8 });
  playTone({ ctx, dst, wave: "triangle", f0: 290 * pitch, f1: 120, duration: 0.1, gain: AUDIO_TUNING.combat.swingGain * 0.55 });
}

export function synthImpact(opts: {
  readonly ctx: AudioContext; readonly dst: AudioNode; readonly substance: GoreSubstance; readonly fatal: boolean;
}): void {
  const { ctx, dst, substance, fatal } = opts;
  const baseGain = AUDIO_TUNING.combat.impactGain;
  if (substance === "straw") {
    playNoiseBurst({ ctx, dst, duration: 0.11, freq: 680, filterType: "lowpass", gain: baseGain });
    playTone({ ctx, dst, wave: "triangle", f0: 155, f1: 75, duration: 0.09, gain: baseGain * 0.7 });
    return;
  }
  const wetFreq = substance === "slime" ? 960 : 540;
  playTone({ ctx, dst, wave: "sine", f0: substance === "slime" ? 260 : 185, f1: 65, duration: fatal ? 0.22 : 0.13, gain: fatal ? baseGain * 1.3 : baseGain * 0.9 });
  playNoiseBurst({ ctx, dst, duration: fatal ? 0.24 : 0.14, freq: wetFreq, filterType: "bandpass", gain: fatal ? baseGain * 1.3 : baseGain * 0.8, q: 2.2 });
}

export type CombatCueKind = "block" | "parry" | "bowDraw" | "arrowFire" | "dodge" | "telegraph" | "heal" | "respawn";

export function synthCombatCue(ctx: AudioContext, dst: AudioNode, kind: CombatCueKind): void {
  if (kind === "parry") {
    playTone({ ctx, dst, wave: "triangle", f0: 1180, f1: 1620, duration: 0.28, gain: AUDIO_TUNING.combat.parryGain });
    playTone({ ctx, dst, wave: "sine", f0: 2360, f1: 1900, duration: 0.22, gain: AUDIO_TUNING.combat.parryGain * 0.58 });
    return;
  }
  if (kind === "block") {
    playTone({ ctx, dst, wave: "square", f0: 210, f1: 95, duration: 0.09, gain: 0.12 });
    playNoiseBurst({ ctx, dst, duration: 0.08, freq: 820, filterType: "bandpass", gain: 0.15 });
    return;
  }
  if (kind === "arrowFire") {
    playTone({ ctx, dst, wave: "triangle", f0: 420, f1: 160, duration: 0.12, gain: 0.16 });
    playNoiseBurst({ ctx, dst, duration: 0.11, freq: 2100, filterType: "highpass", gain: 0.1 });
    return;
  }
  if (kind === "heal" || kind === "respawn") {
    playTone({ ctx, dst, wave: "sine", f0: 523, f1: 659, duration: 0.14, gain: 0.12 });
    playTone({ ctx, dst, wave: "sine", f0: 659, f1: 988, duration: 0.18, gain: 0.11, delay: 0.08 });
    return;
  }
  if (kind === "telegraph") {
    playTone({ ctx, dst, wave: "sawtooth", f0: 320, f1: 520, duration: 0.16, gain: 0.09 });
    return;
  }
  playNoiseBurst({ ctx, dst, duration: 0.13, freq: 720, filterType: "bandpass", gain: 0.14 });
}

export function synthUi(ctx: AudioContext, dst: AudioNode, kind: "click" | "equip" | "craft" | "open"): void {
  if (kind === "craft") {
    playTone({ ctx, dst, wave: "triangle", f0: 680, f1: 960, duration: 0.14, gain: 0.13 });
    playTone({ ctx, dst, wave: "sine", f0: 960, f1: 1320, duration: 0.18, gain: 0.11, delay: 0.07 });
    return;
  }
  if (kind === "equip") {
    playTone({ ctx, dst, wave: "triangle", f0: 310, f1: 420, duration: 0.08, gain: 0.12 });
    return;
  }
  playTone({ ctx, dst, wave: "sine", f0: kind === "open" ? 420 : 540, f1: 660, duration: 0.06, gain: 0.08 });
}
