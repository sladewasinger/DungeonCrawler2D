/** Shared Web Audio synthesis core (White/Pink/Brown noise, Attack/Hold/Decay, stereo pan, track slicing). */
import { scheduleVocalTrack } from "./creatures/vocalSynth.js";

export type NoiseColor = "white" | "pink" | "brown";
export type ProceduralTrackKind = "noise" | "sweptNoise" | "tone" | "vocal";

export interface ProceduralTrackSpec {
  readonly id: string;
  readonly name: string;
  readonly kind: ProceduralTrackKind;
  readonly wave: OscillatorType;
  readonly filterType: BiquadFilterType;
  readonly noiseColor: NoiseColor;
  readonly f0: number;
  readonly f1: number;
  readonly q: number;
  readonly delaySec: number;
  readonly durationSec: number;
  readonly attackSec: number;
  readonly holdSec: number;
  readonly gain: number;
  readonly pan: number;
  readonly enabled: boolean;
  readonly solo: boolean;
}

export interface TrackWindow {
  readonly startDelaySec: number;
  readonly durationSec: number;
  readonly f0: number;
  readonly f1: number;
  readonly attackSec: number;
  readonly holdSec: number;
}

export interface ActiveTrackVoice {
  stop(atTime: number): void;
}

const KINDS: readonly ProceduralTrackKind[] = ["noise", "sweptNoise", "tone", "vocal"];
const WAVES: readonly OscillatorType[] = ["sine", "triangle", "square", "sawtooth"];
const FILTERS: readonly BiquadFilterType[] = ["lowpass", "bandpass", "highpass"];
const COLORS: readonly NoiseColor[] = ["white", "pink", "brown"];
const NOISE_CACHE = new WeakMap<BaseAudioContext, Map<NoiseColor, AudioBuffer>>();

function clampNum(v: unknown, b: { readonly lo: number; readonly hi: number; readonly fallback: number }): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : b.fallback;
  return Math.max(b.lo, Math.min(b.hi, n));
}

function pickEnum<T extends string>(val: unknown, list: readonly T[], fallback: T): T {
  return typeof val === "string" && list.includes(val as T) ? (val as T) : fallback;
}

function normalizeTiming(raw: Partial<ProceduralTrackSpec>) {
  return {
    delaySec: clampNum(raw.delaySec, { lo: 0, hi: 3, fallback: 0 }),
    durationSec: clampNum(raw.durationSec, { lo: 0.02, hi: 3, fallback: 0.14 }),
    attackSec: clampNum(raw.attackSec, { lo: 0.002, hi: 1, fallback: 0.015 }),
    holdSec: clampNum(raw.holdSec, { lo: 0, hi: 2.5, fallback: 0 }),
  };
}

function normalizeLevels(raw: Partial<ProceduralTrackSpec>) {
  return {
    f0: clampNum(raw.f0, { lo: 20, hi: 10000, fallback: 440 }),
    f1: clampNum(raw.f1, { lo: 20, hi: 10000, fallback: 440 }),
    q: clampNum(raw.q, { lo: 0.1, hi: 12, fallback: 1.0 }),
    gain: clampNum(raw.gain, { lo: 0.005, hi: 1, fallback: 0.18 }),
    pan: clampNum(raw.pan, { lo: -1, hi: 1, fallback: 0 }),
  };
}

export function normalizeTrackSpec(raw: Partial<ProceduralTrackSpec>, fallbackId: string): ProceduralTrackSpec {
  const id = typeof raw.id === "string" && raw.id ? raw.id : fallbackId;
  const name = typeof raw.name === "string" && raw.name ? raw.name : "Layer";
  return {
    id,
    name,
    kind: pickEnum(raw.kind, KINDS, "noise"),
    wave: pickEnum(raw.wave, WAVES, "sine"),
    filterType: pickEnum(raw.filterType, FILTERS, "lowpass"),
    noiseColor: pickEnum(raw.noiseColor, COLORS, "white"),
    ...normalizeLevels(raw),
    ...normalizeTiming(raw),
    enabled: raw.enabled !== false,
    solo: raw.solo === true,
  };
}

function fillPinkNoise(data: Float32Array): void {
  let b0 = 0, b1 = 0, b2 = 0;
  let b3 = 0, b4 = 0, b5 = 0;
  let b6 = 0;
  for (let i = 0; i < data.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520;
    b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.0168980;
    const raw = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
    data[i] = Math.max(-1, Math.min(1, raw));
  }
}

function fillBrownNoise(data: Float32Array): void {
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = Math.max(-1, Math.min(1, last * 3.5));
  }
}

export function fillNoiseSamples(data: Float32Array, color: NoiseColor): void {
  if (color === "pink") { fillPinkNoise(data); return; }
  if (color === "brown") { fillBrownNoise(data); return; }
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
}

export function getColoredNoiseBuffer(ctx: BaseAudioContext, color: NoiseColor = "white"): AudioBuffer {
  let ctxMap = NOISE_CACHE.get(ctx);
  if (!ctxMap) { ctxMap = new Map(); NOISE_CACHE.set(ctx, ctxMap); }
  const cached = ctxMap.get(color);
  if (cached) return cached;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 3.5), ctx.sampleRate);
  fillNoiseSamples(buf.getChannelData(0), color);
  ctxMap.set(color, buf);
  return buf;
}

export function applyTrackEnvelope(opts: {
  readonly gainParam: AudioParam; readonly now: number; readonly peak: number;
  readonly attackSec: number; readonly holdSec: number; readonly durationSec: number;
}): void {
  const dur = Math.max(0.015, opts.durationSec);
  const peak = Math.max(0.001, opts.peak);
  const attack = Math.min(dur * 0.65, Math.max(0.002, opts.attackSec));
  const hold = Math.min(Math.max(0, dur - attack - 0.004), Math.max(0, opts.holdSec));
  const tPeak = opts.now + attack;
  opts.gainParam.setValueAtTime(0.0001, opts.now);
  opts.gainParam.linearRampToValueAtTime(peak, tPeak);
  if (hold > 0.001) opts.gainParam.setValueAtTime(peak, tPeak + hold);
  opts.gainParam.exponentialRampToValueAtTime(0.0001, opts.now + dur);
}

export function detachAudioNodesOnEnded(src: AudioScheduledSourceNode, nodes: readonly AudioNode[]): void {
  src.onended = () => {
    for (const node of nodes) {
      try { node.disconnect(); } catch { /* detached */ }
    }
  };
}

export function connectWithPan(opts: {
  readonly ctx: BaseAudioContext; readonly src: AudioNode; readonly dst: AudioNode; readonly pan?: number | undefined;
}): AudioNode | null {
  const pan = Math.max(-1, Math.min(1, opts.pan ?? 0));
  if (Math.abs(pan) > 0.005 && typeof opts.ctx.createStereoPanner === "function") {
    const panner = opts.ctx.createStereoPanner();
    panner.pan.value = pan;
    opts.src.connect(panner).connect(opts.dst);
    return panner;
  }
  opts.src.connect(opts.dst);
  return null;
}

export function activeProceduralTracks(tracks: readonly ProceduralTrackSpec[]): readonly ProceduralTrackSpec[] {
  const anySolo = tracks.some((t) => t.solo);
  return tracks.filter((t) => (anySolo ? t.solo : t.enabled));
}

export function exactTracksDurationSec(tracks: readonly ProceduralTrackSpec[]): number {
  let maxEnd = 0;
  for (const t of tracks) maxEnd = Math.max(maxEnd, t.delaySec + t.durationSec);
  return maxEnd > 0 ? maxEnd : 0.05;
}

export function computeTrackWindow(track: ProceduralTrackSpec, offsetSec: number): TrackWindow | null {
  const endSec = track.delaySec + track.durationSec;
  if (endSec <= offsetSec) return null;
  if (track.delaySec >= offsetSec) {
    return {
      startDelaySec: track.delaySec - offsetSec, durationSec: track.durationSec,
      f0: track.f0, f1: track.f1, attackSec: track.attackSec, holdSec: track.holdSec,
    };
  }
  const into = offsetSec - track.delaySec;
  const frac = into / Math.max(0.001, track.durationSec);
  const fStart = Math.max(20, track.f0);
  const fEnd = Math.max(20, track.f1);
  const midF0 = track.kind === "noise" ? fStart : fStart * Math.pow(fEnd / fStart, frac);
  const remHold = Math.max(0, track.attackSec + track.holdSec - into - 0.006);
  return {
    startDelaySec: 0, durationSec: Math.max(0.015, endSec - offsetSec),
    f0: midF0, f1: track.f1, attackSec: 0.006, holdSec: remHold,
  };
}

function makeVoiceHandle(stopNode: (t: number) => void, gainNode: GainNode): ActiveTrackVoice {
  let stopped = false;
  return {
    stop(atTime: number): void {
      if (stopped) return;
      stopped = true;
      try {
        gainNode.gain.cancelScheduledValues(atTime);
        gainNode.gain.setValueAtTime(Math.max(0.0001, gainNode.gain.value), atTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, atTime + 0.012);
        stopNode(atTime + 0.015);
      } catch {
        // Ignore voices that already finished cleanly.
      }
    },
  };
}

function scheduleToneTrack(opts: {
  readonly ctx: BaseAudioContext; readonly g: GainNode; readonly dst: AudioNode;
  readonly panner: AudioNode | null; readonly track: ProceduralTrackSpec; readonly win: TrackWindow;
  readonly now: number; readonly dur: number;
}): ActiveTrackVoice {
  const osc = opts.ctx.createOscillator();
  osc.type = opts.track.wave;
  osc.frequency.setValueAtTime(Math.max(20, opts.win.f0), opts.now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.win.f1), opts.now + Math.max(0.015, opts.win.durationSec));
  osc.connect(opts.g);
  detachAudioNodesOnEnded(osc, opts.panner ? [osc, opts.g, opts.panner] : [osc, opts.g]);
  osc.start(opts.now);
  osc.stop(opts.now + opts.dur + 0.02);
  return makeVoiceHandle((t) => osc.stop(t), opts.g);
}

function scheduleProceduralTrack(opts: {
  readonly ctx: BaseAudioContext; readonly dst: AudioNode; readonly track: ProceduralTrackSpec;
  readonly win: TrackWindow; readonly baseTime: number; readonly maxDur?: number | undefined;
}): ActiveTrackVoice {
  if (opts.track.kind === "vocal") return scheduleVocalTrack(opts);
  const { ctx, dst, track, win, baseTime } = opts;
  const now = baseTime + win.startDelaySec;
  const dur = Math.max(0.015, opts.maxDur ? Math.min(win.durationSec, opts.maxDur) : win.durationSec);
  const g = ctx.createGain();
  applyTrackEnvelope({ gainParam: g.gain, now, peak: track.gain, attackSec: win.attackSec, holdSec: win.holdSec, durationSec: dur });
  const panner = connectWithPan({ ctx, src: g, dst, pan: track.pan });
  if (track.kind === "tone") return scheduleToneTrack({ ctx, g, dst, panner, track, win, now, dur });
  const src = ctx.createBufferSource();
  src.buffer = getColoredNoiseBuffer(ctx, track.noiseColor);
  const filter = ctx.createBiquadFilter();
  filter.type = track.filterType;
  filter.Q.value = Math.max(0.1, track.q);
  filter.frequency.setValueAtTime(Math.max(30, win.f0), now);
  if (track.kind === "sweptNoise") {
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, win.f1), now + Math.max(0.015, win.durationSec));
  }
  src.connect(filter).connect(g);
  detachAudioNodesOnEnded(src, panner ? [src, filter, g, panner] : [src, filter, g]);
  src.start(now, Math.random() * 0.4, dur + 0.03);
  return makeVoiceHandle((t) => src.stop(t), g);
}

export function playProceduralTracks(opts: {
  readonly ctx: BaseAudioContext; readonly dst: AudioNode; readonly tracks: readonly ProceduralTrackSpec[];
  readonly offsetSec?: number | undefined; readonly maxDur?: number | undefined;
}): ActiveTrackVoice[] {
  const voices: ActiveTrackVoice[] = [];
  const baseTime = opts.ctx.currentTime + 0.012;
  for (const track of activeProceduralTracks(opts.tracks)) {
    const win = computeTrackWindow(track, opts.offsetSec ?? 0);
    if (win) voices.push(scheduleProceduralTrack({ ctx: opts.ctx, dst: opts.dst, track, win, baseTime, maxDur: opts.maxDur }));
  }
  return voices;
}
