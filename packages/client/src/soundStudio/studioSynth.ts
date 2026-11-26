/** Sound Studio Web Audio transport wrapper: exact duration playback, Stop, scrub slice, and stereo WAV export. */
import {
  activeProceduralTracks, computeTrackWindow, exactTracksDurationSec, playProceduralTracks,
  type ActiveTrackVoice, type TrackWindow,
} from "../audio/proceduralSynth.js";
import type { SoundTrackSpec } from "./studioTypes.js";

export { computeTrackWindow, type TrackWindow };

export function activeStudioTracks(tracks: readonly SoundTrackSpec[]): readonly SoundTrackSpec[] {
  return activeProceduralTracks(tracks);
}

function writeAsciiTag(view: DataView, off: number, tag: string): void {
  for (let i = 0; i < tag.length; i++) view.setUint8(off + i, tag.charCodeAt(i));
}

function encodeWavPcm16Stereo(buf: AudioBuffer): Blob {
  const chCount = Math.min(2, Math.max(1, buf.numberOfChannels));
  const frames = buf.length;
  const dataBytes = frames * chCount * 2;
  const ab = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(ab);
  writeAsciiTag(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAsciiTag(view, 8, "WAVE");
  writeAsciiTag(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, chCount, true);
  view.setUint32(24, buf.sampleRate, true);
  view.setUint32(28, buf.sampleRate * chCount * 2, true);
  view.setUint16(32, chCount * 2, true);
  view.setUint16(34, 16, true);
  writeAsciiTag(view, 36, "data");
  view.setUint32(40, dataBytes, true);
  const left = buf.getChannelData(0);
  const right = chCount > 1 ? buf.getChannelData(1) : left;
  for (let i = 0; i < frames; i++) {
    const l = Math.max(-1, Math.min(1, left[i] ?? 0));
    view.setInt16(44 + i * chCount * 2, Math.round(l * 32767), true);
    if (chCount > 1) {
      const r = Math.max(-1, Math.min(1, right[i] ?? 0));
      view.setInt16(44 + (i * chCount + 1) * 2, Math.round(r * 32767), true);
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}

export class StudioSynthEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private activeVoices: ActiveTrackVoice[] = [];

  private ensureAudio(): { readonly ctx: AudioContext; readonly dst: AudioNode } {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.9;
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.masterGain.connect(this.analyser).connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return { ctx: this.ctx, dst: this.masterGain! };
  }

  stopAll(): void {
    if (!this.ctx || this.activeVoices.length === 0) return;
    const now = this.ctx.currentTime;
    for (const v of this.activeVoices) v.stop(now);
    this.activeVoices = [];
  }

  play(tracks: readonly SoundTrackSpec[]): number {
    return this.playFrom(tracks, 0);
  }

  playFrom(tracks: readonly SoundTrackSpec[], offsetSec = 0): number {
    this.stopAll();
    const { ctx, dst } = this.ensureAudio();
    const audible = activeStudioTracks(tracks);
    this.activeVoices = playProceduralTracks({ ctx, dst, tracks: audible, offsetSec });
    const fullEnd = exactTracksDurationSec(tracks);
    return Math.max(0.03, fullEnd - offsetSec);
  }

  playScrubSlice(tracks: readonly SoundTrackSpec[], offsetSec: number): void {
    this.stopAll();
    const { ctx, dst } = this.ensureAudio();
    this.activeVoices = playProceduralTracks({ ctx, dst, tracks, offsetSec, maxDur: 0.075 });
  }

  sampleAnalyser(floatTimeOut: Float32Array<ArrayBuffer>, freqOut: Uint8Array<ArrayBuffer>): number {
    if (!this.analyser || !this.ctx) return 0;
    this.analyser.getFloatTimeDomainData(floatTimeOut);
    this.analyser.getByteFrequencyData(freqOut);
    return this.ctx.sampleRate;
  }

  async renderWavBlob(tracks: readonly SoundTrackSpec[]): Promise<Blob> {
    const audible = activeStudioTracks(tracks);
    const dur = Math.max(0.08, exactTracksDurationSec(audible) + 0.02);
    const sampleRate = 44100;
    const off = new OfflineAudioContext(2, Math.ceil(dur * sampleRate), sampleRate);
    const master = off.createGain();
    master.gain.value = 0.9;
    master.connect(off.destination);
    playProceduralTracks({ ctx: off, dst: master, tracks: audible });
    return encodeWavPcm16Stereo(await off.startRendering());
  }
}

export class StudioTransport {
  private cueSec = 0;
  private playheadSec = 0;
  private playing = false;
  private playOffsetSec = 0;
  private playStartMs = 0;
  private playDurMs = 0;
  private scrubUntilMs = 0;
  private lastScrubAtMs = 0;
  private looping = false;
  private loopTimer: number | null = null;

  constructor(
    readonly synth: StudioSynthEngine,
    private readonly getTracks: () => readonly SoundTrackSpec[],
  ) {}

  resetCue(): void {
    this.cueSec = 0;
    this.stop();
  }

  playFromCue(): void {
    const tracks = this.getTracks();
    const total = exactTracksDurationSec(tracks);
    if (this.cueSec >= total - 0.01) this.cueSec = 0;
    this.playheadSec = this.cueSec;
    this.playOffsetSec = this.cueSec;
    this.playDurMs = this.synth.playFrom(tracks, this.cueSec) * 1000;
    this.playStartMs = performance.now();
    this.playing = true;
  }

  stop(): void {
    this.synth.stopAll();
    this.playing = false;
    this.playheadSec = this.cueSec;
  }

  seek(sec: number, scrubbing: boolean): void {
    this.playing = false;
    this.cueSec = sec;
    this.playheadSec = sec;
    if (!scrubbing) return;
    const now = performance.now();
    if (now - this.lastScrubAtMs < 75) return;
    this.lastScrubAtMs = now;
    this.scrubUntilMs = now + 115;
    this.synth.playScrubSlice(this.getTracks(), sec);
  }

  toggleLoop(): boolean {
    this.looping = !this.looping;
    if (this.loopTimer !== null) { window.clearInterval(this.loopTimer); this.loopTimer = null; }
    if (!this.looping) return false;
    this.playFromCue();
    this.loopTimer = window.setInterval(() => {
      if (!this.playing && performance.now() - this.playStartMs >= this.playDurMs + 160) this.playFromCue();
    }, 80);
    return true;
  }

  stepFrame(now: number): {
    readonly totalSec: number; readonly cueSec: number; readonly playheadSec: number; readonly activeAudio: boolean;
  } {
    const totalSec = exactTracksDurationSec(this.getTracks());
    if (this.cueSec > totalSec) this.cueSec = totalSec;
    if (this.playing) {
      const elapsed = now - this.playStartMs;
      if (elapsed >= this.playDurMs) { this.playing = false; this.playheadSec = this.cueSec; }
      else this.playheadSec = Math.min(totalSec, this.playOffsetSec + elapsed / 1000);
    }
    return {
      totalSec, cueSec: this.cueSec, playheadSec: this.playheadSec,
      activeAudio: this.playing || now < this.scrubUntilMs,
    };
  }
}
