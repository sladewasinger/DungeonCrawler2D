/** Web Audio synthesizer + OfflineAudioContext WAV exporter for multi-track presets. */
import type { SoundTrackSpec } from "./studioTypes.js";

function makeNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * 1.5);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function scheduleToneTrack(opts: {
  readonly ctx: BaseAudioContext; readonly dst: AudioNode; readonly track: SoundTrackSpec; readonly baseTime: number;
}): void {
  const { ctx, dst, track, baseTime } = opts;
  const now = baseTime + track.delaySec;
  const dur = Math.max(0.015, track.durationSec);
  const osc = ctx.createOscillator();
  osc.type = track.wave;
  osc.frequency.setValueAtTime(Math.max(25, track.f0), now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(25, track.f1), now + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.linearRampToValueAtTime(Math.max(0.001, track.gain), now + Math.min(dur * 0.45, track.attackSec));
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(g).connect(dst);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

function scheduleNoiseTrack(opts: {
  readonly ctx: BaseAudioContext; readonly dst: AudioNode; readonly noise: AudioBuffer; readonly track: SoundTrackSpec; readonly baseTime: number;
}): void {
  const { ctx, dst, noise, track, baseTime } = opts;
  const now = baseTime + track.delaySec;
  const dur = Math.max(0.015, track.durationSec);
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = track.filterType;
  filter.Q.value = Math.max(0.1, track.q);
  filter.frequency.setValueAtTime(Math.max(40, track.f0), now);
  if (track.kind === "sweptNoise") filter.frequency.exponentialRampToValueAtTime(Math.max(40, track.f1), now + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.linearRampToValueAtTime(Math.max(0.001, track.gain), now + Math.min(dur * 0.45, track.attackSec));
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
    const { ctx, dst, noise } = this.ensureAudio();
    const audible = activeStudioTracks(tracks);
    const baseTime = ctx.currentTime + 0.015;
    for (const track of audible) {
      if (track.kind === "tone") scheduleToneTrack({ ctx, dst, track, baseTime });
      else scheduleNoiseTrack({ ctx, dst, noise, track, baseTime });
    }
    return totalTracksDurationSec(audible);
  }

  sampleAnalyser(timeDomainOut: Uint8Array<ArrayBuffer>, freqOut: Uint8Array<ArrayBuffer>): number {
    if (!this.analyser || !this.ctx) return 0;
    this.analyser.getByteTimeDomainData(timeDomainOut);
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
      if (track.kind === "tone") scheduleToneTrack({ ctx: off, dst: master, track, baseTime: 0.005 });
      else scheduleNoiseTrack({ ctx: off, dst: master, noise, track, baseTime: 0.005 });
    }
    const rendered = await off.startRendering();
    return encodeWavPcm16(rendered);
  }
}
