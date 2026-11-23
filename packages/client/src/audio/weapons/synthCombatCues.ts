/** Extended combat & status cue synthesizers consumed by synthSfx.ts. */
import { AUDIO_TUNING } from "../audioTuning.js";
import { playNoiseBurst, playSweptNoise, playTone, type CombatCueKind } from "../synthSfx.js";

const WAVE_TRI: OscillatorType = "triangle";
const WAVE_SINE: OscillatorType = "sine";
const FILTER_BP: BiquadFilterType = "bandpass";

export const EXTENDED_SIMPLE_CUES: Partial<Record<CombatCueKind, (ctx: AudioContext, dst: AudioNode) => void>> = {
  backstab: (ctx, dst) => {
    playTone({ ctx, dst, wave: WAVE_SINE, f0: 1080, f1: 1860, duration: 0.16, gain: 0.19 });
    playTone({ ctx, dst, wave: WAVE_TRI, f0: 165, f1: 68, duration: 0.12, gain: 0.15 });
    playNoiseBurst({ ctx, dst, duration: 0.11, freq: 2900, filterType: "highpass", gain: 0.14 });
  },
  guardBreak: (ctx, dst) => {
    playTone({ ctx, dst, wave: "sawtooth", f0: 240, f1: 58, duration: 0.22, gain: 0.2 });
    playNoiseBurst({ ctx, dst, duration: 0.18, freq: 1450, filterType: FILTER_BP, gain: 0.18, q: 1.6 });
  },
  riposte: (ctx, dst) => {
    playTone({ ctx, dst, wave: WAVE_SINE, f0: 1280, f1: 1980, duration: 0.18, gain: 0.18 });
    playNoiseBurst({ ctx, dst, duration: 0.1, freq: 3100, filterType: "highpass", gain: 0.15 });
  },
  heavyCharge: (ctx, dst) => playTone({ ctx, dst, wave: WAVE_SINE, f0: 520, f1: 920, duration: 0.12, gain: 0.11 }),
  slamImpact: (ctx, dst) => {
    playTone({ ctx, dst, wave: WAVE_TRI, f0: 118, f1: 36, duration: 0.22, gain: 0.21 });
    playNoiseBurst({ ctx, dst, duration: 0.2, freq: 420, filterType: "lowpass", gain: 0.19 });
  },
  burnTick: (ctx, dst) => {
    playNoiseBurst({ ctx, dst, duration: 0.08, freq: 1850, filterType: FILTER_BP, gain: 0.1, q: 1.8 });
    playTone({ ctx, dst, wave: WAVE_TRI, f0: 420, f1: 240, duration: 0.06, gain: 0.06 });
  },
  burnExtinguish: (ctx, dst) => playSweptNoise({ ctx, dst, duration: 0.24, f0: 2800, f1: 720, filterType: "highpass", gain: 0.13, q: 1.2, attackSec: 0.015 }),
  poisonTick: (ctx, dst) => playTone({ ctx, dst, wave: WAVE_SINE, f0: 290, f1: 180, duration: 0.1, gain: 0.08 }),
  webSpit: (ctx, dst) => playSweptNoise({ ctx, dst, duration: 0.15, f0: 2200, f1: 680, filterType: FILTER_BP, gain: 0.12, q: 2.0, attackSec: 0.01 }),
  webCut: (ctx, dst) => playSweptNoise({ ctx, dst, duration: 0.09, f0: 3400, f1: 1200, filterType: "highpass", gain: 0.11, q: 1.4, attackSec: 0.005 }),
  cocoonWrap: (ctx, dst) => playSweptNoise({ ctx, dst, duration: 0.2, f0: 900, f1: 1800, filterType: FILTER_BP, gain: 0.12, q: 2.2, attackSec: 0.02 }),
  cocoonBreak: (ctx, dst) => {
    playSweptNoise({ ctx, dst, duration: 0.18, f0: 2800, f1: 900, filterType: "highpass", gain: 0.15, q: 1.5, attackSec: 0.01 });
    playTone({ ctx, dst, wave: WAVE_SINE, f0: 660, f1: 990, duration: 0.14, gain: 0.12 });
  },
  parry: (ctx, dst) => {
    playTone({ ctx, dst, wave: WAVE_TRI, f0: 1180, f1: 1620, duration: 0.28, gain: AUDIO_TUNING.combat.parryGain });
    playTone({ ctx, dst, wave: WAVE_SINE, f0: 2360, f1: 1900, duration: 0.22, gain: AUDIO_TUNING.combat.parryGain * 0.58 });
  },
};
