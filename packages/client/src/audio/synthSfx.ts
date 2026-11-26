/** Procedural Web Audio API SFX synthesis with shared noise/tone envelope builders. */
import type { GoreSubstance, WeaponArchetype } from "@dc2d/engine";
import { AUDIO_TUNING } from "./audioTuning.js";
import { playSavedStudioPreset } from "./studioOverrides.js";
import { synthWeaponSwingByArchetype } from "./weapons/synthWeaponSfx.js";
import { EXTENDED_SIMPLE_CUES } from "./weapons/synthCombatCues.js";
import {
  applyTrackEnvelope, connectWithPan, detachAudioNodesOnEnded, getColoredNoiseBuffer, playProceduralTracks,
  type NoiseColor, type ProceduralTrackSpec,
} from "./proceduralSynth.js";

export { playProceduralTracks, type NoiseColor, type ProceduralTrackSpec };

interface NoiseBurstOpts {
  readonly ctx: AudioContext;
  readonly dst: AudioNode;
  readonly duration: number;
  readonly freq: number;
  readonly filterType: BiquadFilterType;
  readonly gain: number;
  readonly noiseColor?: NoiseColor;
  readonly q?: number;
  readonly holdSec?: number;
  readonly pan?: number;
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
  readonly holdSec?: number;
  readonly pan?: number;
  readonly delay?: number;
}

export interface SweptNoiseOpts {
  readonly ctx: AudioContext;
  readonly dst: AudioNode;
  readonly duration: number;
  readonly f0: number;
  readonly f1: number;
  readonly filterType: BiquadFilterType;
  readonly gain: number;
  readonly noiseColor?: NoiseColor;
  readonly q: number;
  readonly attackSec: number;
  readonly holdSec?: number;
  readonly pan?: number;
  readonly delay?: number;
}

const WAVE_TRI: OscillatorType = "triangle";
const WAVE_SINE: OscillatorType = "sine";
const FILTER_BP: BiquadFilterType = "bandpass";

export function getSharedNoiseBuffer(ctx: AudioContext, color: NoiseColor = "white"): AudioBuffer {
  return getColoredNoiseBuffer(ctx, color);
}

export function playNoiseBurst(opts: NoiseBurstOpts): void {
  const { ctx, dst, duration } = opts;
  const src = ctx.createBufferSource();
  src.buffer = getColoredNoiseBuffer(ctx, opts.noiseColor ?? "white");
  src.playbackRate.value = 0.92 + Math.random() * 0.16;
  const filter = ctx.createBiquadFilter();
  filter.type = opts.filterType;
  filter.frequency.value = opts.freq;
  filter.Q.value = opts.q ?? 1.2;
  const g = ctx.createGain();
  const now = ctx.currentTime + (opts.delay ?? 0);
  applyTrackEnvelope({
    gainParam: g.gain, now, peak: opts.gain,
    attackSec: Math.min(0.014, duration * 0.2), holdSec: opts.holdSec ?? 0, durationSec: duration,
  });
  src.connect(filter).connect(g);
  const panner = connectWithPan({ ctx, src: g, dst, pan: opts.pan });
  detachAudioNodesOnEnded(src, panner ? [src, filter, g, panner] : [src, filter, g]);
  src.start(now, Math.random() * 0.4, duration + 0.02);
}

export function playSweptNoise(opts: SweptNoiseOpts): void {
  const { ctx, dst, duration } = opts;
  const now = ctx.currentTime + (opts.delay ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = getColoredNoiseBuffer(ctx, opts.noiseColor ?? "white");
  src.playbackRate.value = 0.88 + Math.random() * 0.24;
  const filter = ctx.createBiquadFilter();
  filter.type = opts.filterType;
  filter.Q.value = opts.q;
  filter.frequency.setValueAtTime(opts.f0, now);
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.f1), now + duration);
  const g = ctx.createGain();
  applyTrackEnvelope({
    gainParam: g.gain, now, peak: opts.gain,
    attackSec: opts.attackSec, holdSec: opts.holdSec ?? 0, durationSec: duration,
  });
  src.connect(filter).connect(g);
  const panner = connectWithPan({ ctx, src: g, dst, pan: opts.pan });
  detachAudioNodesOnEnded(src, panner ? [src, filter, g, panner] : [src, filter, g]);
  src.start(now, Math.random() * 0.5, duration + 0.03);
}

export function playTone(opts: ToneOpts): void {
  const { ctx, dst, duration } = opts;
  const now = ctx.currentTime + (opts.delay ?? 0);
  const osc = ctx.createOscillator();
  osc.type = opts.wave;
  osc.frequency.setValueAtTime(opts.f0, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(25, opts.f1), now + duration);
  const g = ctx.createGain();
  applyTrackEnvelope({
    gainParam: g.gain, now, peak: opts.gain,
    attackSec: Math.min(0.012, duration * 0.25), holdSec: opts.holdSec ?? 0, durationSec: duration,
  });
  osc.connect(g);
  const panner = connectWithPan({ ctx, src: g, dst, pan: opts.pan });
  detachAudioNodesOnEnded(osc, panner ? [osc, g, panner] : [osc, g]);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

export function synthSwing(opts: {
  readonly ctx: AudioContext; readonly dst: AudioNode; readonly comboStep: number; readonly archetype?: WeaponArchetype;
}): void {
  const archetype = opts.archetype ?? "sword";
  if (archetype === "sword" && playSavedStudioPreset({ ctx: opts.ctx, dst: opts.dst, presetId: "sword-slash", pitchJitter: 0.08 })) return;
  synthWeaponSwingByArchetype({ ctx: opts.ctx, dst: opts.dst, comboStep: opts.comboStep, archetype });
}

const DRY_IMPACT_SPECS: Partial<Record<GoreSubstance, (ctx: AudioContext, dst: AudioNode, opts: { readonly baseGain: number; readonly fatal: boolean }) => void>> = {
  straw: (ctx, dst, { baseGain }) => {
    playNoiseBurst({ ctx, dst, duration: 0.11, freq: 680, filterType: "lowpass", gain: baseGain });
    playTone({ ctx, dst, wave: WAVE_TRI, f0: 155, f1: 75, duration: 0.09, gain: baseGain * 0.7 });
  },
  stone: (ctx, dst, { baseGain, fatal }) => {
    playNoiseBurst({ ctx, dst, duration: fatal ? 0.2 : 0.12, freq: 1450, filterType: FILTER_BP, gain: baseGain * (fatal ? 1.25 : 0.95), q: 1.4 });
    playTone({ ctx, dst, wave: WAVE_TRI, f0: 140, f1: 52, duration: 0.12, gain: baseGain * 0.85 });
    playTone({ ctx, dst, wave: WAVE_SINE, f0: 1920, f1: 1260, duration: 0.11, gain: baseGain * 0.42 });
    playTone({ ctx, dst, wave: WAVE_SINE, f0: 3120, f1: 2150, duration: 0.08, gain: baseGain * 0.28, delay: 0.01 });
  },
  bone: (ctx, dst, { baseGain, fatal }) => {
    playNoiseBurst({ ctx, dst, duration: fatal ? 0.18 : 0.1, freq: 2150, filterType: FILTER_BP, gain: baseGain * 0.95, q: 2.6 });
    playTone({ ctx, dst, wave: "square", f0: 360, f1: 120, duration: 0.07, gain: baseGain * 0.55 });
  },
};

export function synthImpact(opts: {
  readonly ctx: AudioContext; readonly dst: AudioNode; readonly substance: GoreSubstance; readonly fatal: boolean;
}): void {
  const { ctx, dst, substance, fatal } = opts;
  const baseGain = AUDIO_TUNING.combat.impactGain;
  const dry = DRY_IMPACT_SPECS[substance];
  if (dry) { dry(ctx, dst, { baseGain, fatal }); return; }
  const wetFreq = substance === "slime" ? 960 : 540;
  playTone({ ctx, dst, wave: WAVE_SINE, f0: substance === "slime" ? 260 : 185, f1: 65, duration: fatal ? 0.22 : 0.13, gain: fatal ? baseGain * 1.3 : baseGain * 0.9 });
  playNoiseBurst({ ctx, dst, duration: fatal ? 0.24 : 0.14, freq: wetFreq, filterType: FILTER_BP, gain: fatal ? baseGain * 1.3 : baseGain * 0.8, q: 2.2 });
}

export type CombatCueKind =
  | "block" | "parry" | "guardBreak" | "riposte" | "heavyCharge" | "slamImpact" | "burnTick" | "burnExtinguish"
  | "poisonTick" | "webSpit" | "webCut" | "cocoonWrap" | "cocoonBreak"
  | "bowDraw" | "arrowFire" | "arrowEmbed" | "arrowRicochet" | "dodge" | "telegraph"
  | "heal" | "respawn" | "chestOpen" | "loot" | "playerLeave" | "distract" | "backstab"
  | "ambushShot" | "wolfHowl" | "bearBluff" | "boarCrash" | "pebbleLand"
  | "harvestHit" | "harvestBreak" | "placeStructure" | "bedSet";

const SIMPLE_CUES: Partial<Record<CombatCueKind, (ctx: AudioContext, dst: AudioNode) => void>> = {
  arrowEmbed: (ctx, dst) => playNoiseBurst({ ctx, dst, duration: 0.08, freq: 420, filterType: FILTER_BP, gain: 0.14, q: 2.0 }),
  arrowRicochet: (ctx, dst) => {
    playTone({ ctx, dst, wave: WAVE_TRI, f0: 1580, f1: 980, duration: 0.14, gain: 0.15 });
    playNoiseBurst({ ctx, dst, duration: 0.09, freq: 2400, filterType: FILTER_BP, gain: 0.12, q: 3.0 });
  },
  distract: (ctx, dst) => {
    playTone({ ctx, dst, wave: WAVE_TRI, f0: 760, f1: 480, duration: 0.07, gain: 0.13 });
    playNoiseBurst({ ctx, dst, duration: 0.06, freq: 1400, filterType: FILTER_BP, gain: 0.1, q: 2.5 });
  },
  pebbleLand: (ctx, dst) => {
    playTone({ ctx, dst, wave: WAVE_TRI, f0: 880, f1: 520, duration: 0.06, gain: 0.13 });
    playNoiseBurst({ ctx, dst, duration: 0.045, freq: 1850, filterType: FILTER_BP, gain: 0.09, q: 2.8 });
  },
  ambushShot: (ctx, dst) => {
    playTone({ ctx, dst, wave: WAVE_SINE, f0: 880, f1: 1480, duration: 0.14, gain: 0.16 });
    playNoiseBurst({ ctx, dst, duration: 0.09, freq: 2400, filterType: "highpass", gain: 0.12 });
  },
  wolfHowl: (ctx, dst) => {
    playTone({ ctx, dst, wave: WAVE_SINE, f0: 290, f1: 465, duration: 0.34, gain: 0.15 });
    playTone({ ctx, dst, wave: WAVE_TRI, f0: 465, f1: 330, duration: 0.3, gain: 0.1, delay: 0.28 });
  },
  bearBluff: (ctx, dst) => {
    playTone({ ctx, dst, wave: "sawtooth", f0: 145, f1: 78, duration: 0.28, gain: 0.17 });
    playNoiseBurst({ ctx, dst, duration: 0.24, freq: 340, filterType: "lowpass", gain: 0.15 });
  },
  boarCrash: (ctx, dst) => {
    playTone({ ctx, dst, wave: "square", f0: 190, f1: 58, duration: 0.2, gain: 0.18 });
    playNoiseBurst({ ctx, dst, duration: 0.16, freq: 620, filterType: "lowpass", gain: 0.16 });
  },
  placeStructure: (ctx, dst) => {
    playTone({ ctx, dst, wave: WAVE_TRI, f0: 260, f1: 120, duration: 0.11, gain: 0.16 });
    playTone({ ctx, dst, wave: WAVE_SINE, f0: 520, f1: 780, duration: 0.12, gain: 0.11, delay: 0.05 });
  },
  bedSet: (ctx, dst) => {
    playTone({ ctx, dst, wave: WAVE_SINE, f0: 440, f1: 660, duration: 0.16, gain: 0.14 });
    playTone({ ctx, dst, wave: WAVE_SINE, f0: 660, f1: 880, duration: 0.2, gain: 0.12, delay: 0.09 });
  },
  block: (ctx, dst) => {
    playTone({ ctx, dst, wave: "square", f0: 210, f1: 95, duration: 0.09, gain: 0.12 });
    playNoiseBurst({ ctx, dst, duration: 0.08, freq: 820, filterType: FILTER_BP, gain: 0.15 });
  },
  arrowFire: (ctx, dst) => {
    playTone({ ctx, dst, wave: WAVE_TRI, f0: 420, f1: 160, duration: 0.12, gain: 0.16 });
    playNoiseBurst({ ctx, dst, duration: 0.11, freq: 2100, filterType: "highpass", gain: 0.1 });
  },
  telegraph: (ctx, dst) => playTone({ ctx, dst, wave: "sawtooth", f0: 320, f1: 520, duration: 0.16, gain: 0.09 }),
  chestOpen: (ctx, dst) => {
    playSweptNoise({ ctx, dst, duration: 0.16, f0: 260, f1: 540, filterType: FILTER_BP, gain: 0.12, q: 2.4, attackSec: 0.02 });
    playTone({ ctx, dst, wave: WAVE_SINE, f0: 523, f1: 659, duration: 0.12, gain: 0.11, delay: 0.04 });
    playTone({ ctx, dst, wave: WAVE_SINE, f0: 784, f1: 1046, duration: 0.22, gain: 0.13, delay: 0.11 });
  },
  loot: (ctx, dst) => playTone({ ctx, dst, wave: WAVE_SINE, f0: 880, f1: 1320, duration: 0.09, gain: 0.1 }),
  playerLeave: (ctx, dst) => {
    playTone({ ctx, dst, wave: WAVE_SINE, f0: 155, f1: 42, duration: 0.24, gain: 0.22 });
    playSweptNoise({ ctx, dst, duration: 0.42, f0: 1500, f1: 220, filterType: "lowpass", gain: 0.24, q: 1.1, attackSec: 0.015, noiseColor: "pink" });
  },
};

const STUDIO_CUE_OVERRIDES: Partial<Record<CombatCueKind, string>> = {
  parry: "shield-parry",
  chestOpen: "chest-open",
};

export function synthCombatCue(ctx: AudioContext, dst: AudioNode, kind: CombatCueKind): void {
  const overrideId = STUDIO_CUE_OVERRIDES[kind];
  if (overrideId && playSavedStudioPreset({ ctx, dst, presetId: overrideId })) return;
  const fn = EXTENDED_SIMPLE_CUES[kind] ?? SIMPLE_CUES[kind];
  if (fn) { fn(ctx, dst); return; }
  if (kind === "heal" || kind === "respawn") {
    playTone({ ctx, dst, wave: WAVE_SINE, f0: 523, f1: 659, duration: 0.14, gain: 0.12 });
    playTone({ ctx, dst, wave: WAVE_SINE, f0: 659, f1: 988, duration: 0.18, gain: 0.11, delay: 0.08 });
    return;
  }
  playNoiseBurst({ ctx, dst, duration: 0.13, freq: 720, filterType: FILTER_BP, gain: 0.14 });
}

export function synthUi(ctx: AudioContext, dst: AudioNode, kind: "click" | "equip" | "craft" | "open" | "discover"): void {
  if (kind === "discover") {
    playTone({ ctx, dst, wave: WAVE_SINE, f0: 523, f1: 659, duration: 0.16, gain: 0.12 });
    playTone({ ctx, dst, wave: WAVE_SINE, f0: 784, f1: 1046, duration: 0.24, gain: 0.12, delay: 0.09 });
    return;
  }
  if (kind === "craft") {
    playTone({ ctx, dst, wave: WAVE_TRI, f0: 680, f1: 960, duration: 0.14, gain: 0.13 });
    playTone({ ctx, dst, wave: WAVE_SINE, f0: 960, f1: 1320, duration: 0.18, gain: 0.11, delay: 0.07 });
    return;
  }
  if (kind === "equip") {
    playTone({ ctx, dst, wave: WAVE_TRI, f0: 310, f1: 420, duration: 0.08, gain: 0.12 });
    return;
  }
  playTone({ ctx, dst, wave: WAVE_SINE, f0: kind === "open" ? 420 : 540, f1: 660, duration: 0.06, gain: 0.08 });
}
