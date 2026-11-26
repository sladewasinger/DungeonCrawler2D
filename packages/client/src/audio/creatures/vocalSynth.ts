/** Organic Web Audio animal vocal-tract synthesizer (glottal flutter, breath noise, overdrive, dual formants). */
import {
  applyTrackEnvelope, connectWithPan, detachAudioNodesOnEnded, getColoredNoiseBuffer,
  type ActiveTrackVoice, type ProceduralTrackSpec, type TrackWindow,
} from "../proceduralSynth.js";

export interface VocalTrackScheduleOpts {
  readonly ctx: BaseAudioContext;
  readonly dst: AudioNode;
  readonly track: ProceduralTrackSpec;
  readonly win: TrackWindow;
  readonly baseTime: number;
  readonly maxDur?: number | undefined;
}

interface FormantProfile {
  readonly f1Mul0: number; readonly f1Mul1: number; readonly f1Min0: number; readonly f1Min1: number; readonly f1Q: number;
  readonly f2Mul0: number; readonly f2Mul1: number; readonly f2Min0: number; readonly f2Min1: number; readonly f2Q: number;
  readonly ceilingHz: number;
}

const FORMANT_PROFILES: Record<BiquadFilterType, FormantProfile> = {
  lowpass: { f1Mul0: 2.1, f1Mul1: 1.9, f1Min0: 130, f1Min1: 110, f1Q: 2.4, f2Mul0: 4.6, f2Mul1: 3.8, f2Min0: 380, f2Min1: 260, f2Q: 3.0, ceilingHz: 1450 },
  bandpass: { f1Mul0: 1.9, f1Mul1: 1.7, f1Min0: 260, f1Min1: 220, f1Q: 3.2, f2Mul0: 3.8, f2Mul1: 3.3, f2Min0: 780, f2Min1: 560, f2Q: 3.8, ceilingHz: 2450 },
  highpass: { f1Mul0: 1.6, f1Mul1: 1.4, f1Min0: 620, f1Min1: 420, f1Q: 3.0, f2Mul0: 2.8, f2Mul1: 2.4, f2Min0: 1500, f2Min1: 980, f2Q: 2.6, ceilingHz: 4200 },
  lowshelf: { f1Mul0: 1.9, f1Mul1: 1.7, f1Min0: 260, f1Min1: 220, f1Q: 3.2, f2Mul0: 3.8, f2Mul1: 3.3, f2Min0: 780, f2Min1: 560, f2Q: 3.8, ceilingHz: 2450 },
  highshelf: { f1Mul0: 1.9, f1Mul1: 1.7, f1Min0: 260, f1Min1: 220, f1Q: 3.2, f2Mul0: 3.8, f2Mul1: 3.3, f2Min0: 780, f2Min1: 560, f2Q: 3.8, ceilingHz: 2450 },
  peaking: { f1Mul0: 1.9, f1Mul1: 1.7, f1Min0: 260, f1Min1: 220, f1Q: 3.2, f2Mul0: 3.8, f2Mul1: 3.3, f2Min0: 780, f2Min1: 560, f2Q: 3.8, ceilingHz: 2450 },
  notch: { f1Mul0: 1.9, f1Mul1: 1.7, f1Min0: 260, f1Min1: 220, f1Q: 3.2, f2Mul0: 3.8, f2Mul1: 3.3, f2Min0: 780, f2Min1: 560, f2Q: 3.8, ceilingHz: 2450 },
  allpass: { f1Mul0: 1.9, f1Mul1: 1.7, f1Min0: 260, f1Min1: 220, f1Q: 3.2, f2Mul0: 3.8, f2Mul1: 3.3, f2Min0: 780, f2Min1: 560, f2Q: 3.8, ceilingHz: 2450 },
};

let cachedCurve: Float32Array<ArrayBuffer> | null = null;

function getThroatCurve(): Float32Array<ArrayBuffer> {
  if (cachedCurve) return cachedCurve;
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) curve[i] = Math.tanh(((i * 2) / 255 - 1) * 2.4);
  cachedCurve = curve;
  return curve;
}

function createSweptBandpass(opts: {
  readonly ctx: BaseAudioContext; readonly startHz: number; readonly endHz: number;
  readonly q: number; readonly now: number; readonly rampEnd: number;
}): BiquadFilterNode {
  const f = opts.ctx.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = opts.q;
  f.frequency.setValueAtTime(Math.max(40, opts.startHz), opts.now);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, opts.endHz), opts.rampEnd);
  return f;
}

function createFormantTract(opts: {
  readonly ctx: BaseAudioContext; readonly track: ProceduralTrackSpec;
  readonly f0: number; readonly f1: number; readonly now: number; readonly rampEnd: number;
}): { readonly input: WaveShaperNode; readonly output: BiquadFilterNode; readonly nodes: readonly AudioNode[] } {
  const prof = FORMANT_PROFILES[opts.track.filterType] ?? FORMANT_PROFILES.bandpass;
  const shaper = opts.ctx.createWaveShaper();
  shaper.curve = getThroatCurve();
  shaper.oversample = "2x";
  const form1 = createSweptBandpass({
    ctx: opts.ctx, startHz: Math.max(prof.f1Min0, opts.f0 * prof.f1Mul0),
    endHz: Math.max(prof.f1Min1, opts.f1 * prof.f1Mul1), q: prof.f1Q, now: opts.now, rampEnd: opts.rampEnd,
  });
  const form2 = createSweptBandpass({
    ctx: opts.ctx, startHz: Math.max(prof.f2Min0, opts.f0 * prof.f2Mul0),
    endHz: Math.max(prof.f2Min1, opts.f1 * prof.f2Mul1), q: prof.f2Q, now: opts.now, rampEnd: opts.rampEnd,
  });
  const f2Trim = opts.ctx.createGain();
  f2Trim.gain.value = 0.72;
  const ceiling = opts.ctx.createBiquadFilter();
  ceiling.type = "lowpass";
  ceiling.frequency.value = prof.ceilingHz;
  ceiling.Q.value = 0.85;
  shaper.connect(form1).connect(ceiling);
  shaper.connect(form2).connect(f2Trim).connect(ceiling);
  return { input: shaper, output: ceiling, nodes: [shaper, form1, form2, f2Trim, ceiling] };
}

function makeVocalVoiceHandle(
  stops: readonly ((t: number) => void)[],
  gainNode: GainNode,
): ActiveTrackVoice {
  let stopped = false;
  return {
    stop(atTime: number): void {
      if (stopped) return;
      stopped = true;
      try {
        gainNode.gain.cancelScheduledValues(atTime);
        gainNode.gain.setValueAtTime(Math.max(0.0001, gainNode.gain.value), atTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, atTime + 0.012);
        for (const fn of stops) fn(atTime + 0.015);
      } catch {
        // Ignore nodes that have already completed cleanly.
      }
    },
  };
}

interface FlutterModRig {
  readonly lfo: OscillatorNode;
  readonly carrier: OscillatorNode;
  readonly tractIn: WaveShaperNode;
  readonly breath: AudioBufferSourceNode;
  readonly nodes: readonly AudioNode[];
}

function attachBreathNoise(opts: {
  readonly ctx: BaseAudioContext; readonly track: ProceduralTrackSpec;
  readonly tractIn: WaveShaperNode; readonly now: number; readonly dur: number;
}): { readonly breath: AudioBufferSourceNode; readonly breathGain: GainNode } {
  const breath = opts.ctx.createBufferSource();
  breath.buffer = getColoredNoiseBuffer(opts.ctx, opts.track.noiseColor);
  breath.playbackRate.value = 0.9 + Math.random() * 0.2;
  const breathGain = opts.ctx.createGain();
  breathGain.gain.value = 0.55;
  breath.connect(breathGain).connect(opts.tractIn);
  breath.start(opts.now, Math.random() * 0.4, opts.dur + 0.03);
  return { breath, breathGain };
}

function buildFlutterVoice(opts: {
  readonly ctx: BaseAudioContext; readonly track: ProceduralTrackSpec;
  readonly f0: number; readonly f1: number; readonly now: number; readonly dur: number; readonly rampEnd: number;
  readonly tractIn: WaveShaperNode;
}): FlutterModRig {
  const { ctx, track, f0, f1, now, dur, rampEnd, tractIn } = opts;
  const qClamp = Math.max(0.2, Math.min(10, track.q));
  const carrier = ctx.createOscillator();
  carrier.type = track.wave;
  carrier.frequency.setValueAtTime(f0, now);
  carrier.frequency.exponentialRampToValueAtTime(f1, rampEnd);

  const lfo = ctx.createOscillator();
  lfo.type = "triangle";
  lfo.frequency.value = 22 + qClamp * 3.8;
  const fmGain = ctx.createGain();
  fmGain.gain.value = f0 * (0.14 + ((qClamp - 0.2) / 9.8) * 0.16);
  lfo.connect(fmGain).connect(carrier.frequency);

  const amCarrier = ctx.createGain();
  amCarrier.gain.value = 1;
  const amDepth = ctx.createGain();
  amDepth.gain.value = 0.32;
  lfo.connect(amDepth).connect(amCarrier.gain);

  carrier.connect(amCarrier).connect(tractIn);
  carrier.start(now);
  carrier.stop(now + dur + 0.03);
  lfo.start(now);
  lfo.stop(now + dur + 0.03);
  const { breath, breathGain } = attachBreathNoise({ ctx, track, tractIn, now, dur });
  return { lfo, carrier, tractIn, breath, nodes: [carrier, lfo, fmGain, amCarrier, amDepth, breath, breathGain] };
}

export function scheduleVocalTrack(opts: VocalTrackScheduleOpts): ActiveTrackVoice {
  const { ctx, dst, track, win, baseTime } = opts;
  const now = baseTime + win.startDelaySec;
  const dur = Math.max(0.015, opts.maxDur ? Math.min(win.durationSec, opts.maxDur) : win.durationSec);
  const rampEnd = now + Math.max(0.015, win.durationSec);
  const f0 = Math.max(20, win.f0);
  const f1 = Math.max(20, win.f1);
  const tract = createFormantTract({ ctx, track, f0, f1, now, rampEnd });
  const envGain = ctx.createGain();
  applyTrackEnvelope({ gainParam: envGain.gain, now, peak: track.gain, attackSec: win.attackSec, holdSec: win.holdSec, durationSec: dur });
  tract.output.connect(envGain);
  const panner = connectWithPan({ ctx, src: envGain, dst, pan: track.pan });
  const rig = buildFlutterVoice({ ctx, track, f0, f1, now, dur, rampEnd, tractIn: tract.input });
  detachAudioNodesOnEnded(rig.carrier, [...tract.nodes, ...rig.nodes, envGain, ...(panner ? [panner] : [])]);
  return makeVocalVoiceHandle([(t) => rig.carrier.stop(t), (t) => rig.lfo.stop(t), (t) => rig.breath.stop(t)], envGain);
}
