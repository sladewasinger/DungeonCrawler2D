/** Web Audio synthesizer, playhead offset slicing, scrub preview, and OfflineAudioContext WAV exporter. */
import type { SoundTrackSpec } from "./studioTypes.js";

export interface TrackWindow {
  readonly startDelaySec: number;
  readonly durationSec: number;
  readonly f0: number;
  readonly f1: number;
  readonly attackSec: number;
}

export function computeTrackWindow(track: SoundTrackSpec, offsetSec: number): TrackWindow | null {
  const endSec = track.delaySec + track.durationSec;
  if (endSec <= offsetSec) return null;
  if (track.delaySec >= offsetSec) {
    return {
      startDelaySec: track.delaySec - offsetSec, durationSec: track.durationSec,
      f0: track.f0, f1: track.f1, attackSec: track.attackSec,
    };
  }
  const frac = (offsetSec - track.delaySec) / Math.max(0.001, track.durationSec);
  const fStart = Math.max(25, track.f0);
  const fEnd = Math.max(25, track.f1);
  const midF0 = track.kind === "noise" ? fStart : fStart * Math.pow(fEnd / fStart, frac);
  return {
    startDelaySec: 0,
    durationSec: Math.max(0.015, endSec - offsetSec),
    f0: midF0,
    f1: track.f1,
    attackSec: 0.006,
  };
}

function makeNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * 1.5);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function scheduleToneWindow(opts: {
  readonly ctx: BaseAudioContext; readonly dst: AudioNode; readonly track: SoundTrackSpec;
  readonly win: TrackWindow; readonly baseTime: number; readonly maxDur?: number;
}): void {
  const { ctx, dst, track, win, baseTime } = opts;
  const now = baseTime + win.startDelaySec;
  const dur = Math.max(0.015, opts.maxDur ? Math.min(win.durationSec, opts.maxDur) : win.durationSec);
  const osc = ctx.createOscillator();
  osc.type = track.wave;
  osc.frequency.setValueAtTime(Math.max(25, win.f0), now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(25, win.f1), now + Math.max(0.015, win.durationSec));
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.linearRampToValueAtTime(Math.max(0.001, track.gain), now + Math.min(dur * 0.45, win.attackSec));
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(g).connect(dst);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

function scheduleNoiseWindow(opts: {
  readonly ctx: BaseAudioContext; readonly dst: AudioNode; readonly noise: AudioBuffer;
  readonly track: SoundTrackSpec; readonly win: TrackWindow; readonly baseTime: number; readonly maxDur?: number;
}): void {
  const { ctx, dst, noise, track, win, baseTime } = opts;
  const now = baseTime + win.startDelaySec;
  const dur = Math.max(0.015, opts.maxDur ? Math.min(win.durationSec, opts.maxDur) : win.durationSec);
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = track.filterType;
  filter.Q.value = Math.max(0.1, track.q);
  filter.frequency.setValueAtTime(Math.max(40, win.f0), now);
  if (track.kind === "sweptNoise") {
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, win.f1), now + Math.max(0.015, win.durationSec));
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.linearRampToValueAtTime(Math.max(0.001, track.gain), now + Math.min(dur * 0.45, win.attackSec));
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  src.connect(filter).connect(g).connect(dst);
  src.start(now, Math.random() * 0.35, dur + 0.03);
}

export function activeStudioTracks(tracks: readonly SoundTrackSpec[]): readonly SoundTrackSpec[] {
  const anySolo = tracks.some((t) => t.solo);
  return tracks.filter((t) => (anySolo ? t.solo : t.enabled));
}

export function totalTracksDurationSec(tracks: readonly SoundTrackSpec[]): number {
  let maxEnd = 0.25;
  for (const t of tracks) maxEnd = Math.max(maxEnd, t.delaySec + t.durationSec + 0.04);
  return maxEnd;
}

function encodeWavPcm16(buf: AudioBuffer): Blob {
  const samples = buf.getChannelData(0);
  const ab = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(ab);
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buf.sampleRate, true);
  view.setUint32(28, buf.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(44 + i * 2, Math.round(clamped * 32767), true);
  }
  return new Blob([ab], { type: "audio/wav" });
}

function scheduleWindow(opts: {
  readonly ctx: BaseAudioContext; readonly dst: AudioNode; readonly noise: AudioBuffer;
  readonly track: SoundTrackSpec; readonly win: TrackWindow; readonly baseTime: number; readonly maxDur?: number;
}): void {
  if (opts.track.kind === "tone") scheduleToneWindow(opts);
  else scheduleNoiseWindow(opts);
}

export class StudioSynthEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  private ensureAudio(): { readonly ctx: AudioContext; readonly dst: AudioNode; readonly noise: AudioBuffer } {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.9;
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.masterGain.connect(this.analyser).connect(this.ctx.destination);
      this.noiseBuf = makeNoiseBuffer(this.ctx);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return { ctx: this.ctx, dst: this.masterGain!, noise: this.noiseBuf! };
  }

  play(tracks: readonly SoundTrackSpec[]): number {
    return this.playFrom(tracks, 0);
  }

  playFrom(tracks: readonly SoundTrackSpec[], offsetSec = 0): number {
    const { ctx, dst, noise } = this.ensureAudio();
    const audible = activeStudioTracks(tracks);
    const baseTime = ctx.currentTime + 0.015;
    for (const track of audible) {
      const win = computeTrackWindow(track, offsetSec);
      if (win) scheduleWindow({ ctx, dst, noise, track, win, baseTime });
    }
    return Math.max(0.05, totalTracksDurationSec(audible) - offsetSec);
  }

  playScrubSlice(tracks: readonly SoundTrackSpec[], offsetSec: number): void {
    const { ctx, dst, noise } = this.ensureAudio();
    const baseTime = ctx.currentTime + 0.008;
    for (const track of activeStudioTracks(tracks)) {
      const win = track.delaySec <= offsetSec + 0.075 ? computeTrackWindow(track, offsetSec) : null;
      if (!win) continue;
      const capped: TrackWindow = { ...win, startDelaySec: Math.max(0, track.delaySec - offsetSec), attackSec: 0.006 };
      scheduleWindow({ ctx, dst, noise, track, win: capped, baseTime, maxDur: 0.075 });
    }
  }

  sampleAnalyser(floatTimeOut: Float32Array<ArrayBuffer>, freqOut: Uint8Array<ArrayBuffer>): number {
    if (!this.analyser || !this.ctx) return 0;
    this.analyser.getFloatTimeDomainData(floatTimeOut);
    this.analyser.getByteFrequencyData(freqOut);
    return this.ctx.sampleRate;
  }

  async renderWavBlob(tracks: readonly SoundTrackSpec[]): Promise<Blob> {
    const audible = activeStudioTracks(tracks);
    const dur = Math.max(0.2, totalTracksDurationSec(audible));
    const sampleRate = 44100;
    const off = new OfflineAudioContext(1, Math.ceil(dur * sampleRate), sampleRate);
    const master = off.createGain();
    master.gain.value = 0.9;
    master.connect(off.destination);
    const noise = makeNoiseBuffer(off);
    for (const track of audible) {
      const win = computeTrackWindow(track, 0);
      if (win) scheduleWindow({ ctx: off, dst: master, noise, track, win, baseTime: 0.005 });
    }
    const rendered = await off.startRendering();
    return encodeWavPcm16(rendered);
  }
}
