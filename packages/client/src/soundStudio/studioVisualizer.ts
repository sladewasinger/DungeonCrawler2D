/** Live Oscilloscope Waveform, FFT Frequency Spectrum, and Multi-Track Timeline canvases. */
import type { SoundTrackSpec } from "./studioTypes.js";
import { activeStudioTracks, totalTracksDurationSec } from "./studioSynth.js";

const BG = "#090f17";
const GRID = "rgba(148, 163, 184, 0.14)";
const COLORS: Readonly<Record<SoundTrackSpec["kind"], string>> = {
  tone: "#38bdf8",
  sweptNoise: "#fbbf24",
  noise: "#4ade80",
};

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < 4; i++) {
    const y = (h / 4) * i;
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  for (let i = 1; i < 6; i++) {
    const x = (w / 6) * i;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  ctx.stroke();
}

export class StudioVisualizer {
  private readonly timeBuf = new Uint8Array(1024);
  private readonly freqBuf = new Uint8Array(1024);

  constructor(
    private readonly waveCanvas: HTMLCanvasElement,
    private readonly specCanvas: HTMLCanvasElement,
    private readonly timelineCanvas: HTMLCanvasElement,
  ) {}

  drawLive(opts: {
    readonly sampleRate: number;
    readonly tracks: readonly SoundTrackSpec[];
    readonly hasSignal: boolean;
    readonly playProgress: number;
  }): void {
    this.drawWaveform(opts.hasSignal);
    this.drawSpectrum(opts.sampleRate, opts.hasSignal);
    this.drawTimeline(opts.tracks, opts.playProgress);
  }

  buffers(): { readonly timeBuf: Uint8Array<ArrayBuffer>; readonly freqBuf: Uint8Array<ArrayBuffer> } {
    return { timeBuf: this.timeBuf, freqBuf: this.freqBuf };
  }

  private drawWaveform(hasSignal: boolean): void {
    const ctx = this.waveCanvas.getContext("2d");
    if (!ctx) return;
    const { width: w, height: h } = this.waveCanvas;
    drawGrid(ctx, w, h);
    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const idx = Math.floor((x / w) * this.timeBuf.length);
      const val = hasSignal ? (this.timeBuf[idx] ?? 128) / 128 - 1 : 0;
      const y = h * 0.5 - val * (h * 0.44);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  private drawSpectrum(sampleRate: number, hasSignal: boolean): void {
    const ctx = this.specCanvas.getContext("2d");
    if (!ctx) return;
    const { width: w, height: h } = this.specCanvas;
    drawGrid(ctx, w, h);
    const bars = 48;
    const nyquist = Math.max(8000, (sampleRate || 44100) / 2);
    for (let i = 0; i < bars; i++) {
      const freq = 60 * Math.pow(nyquist / 120, i / bars);
      const bin = Math.min(this.freqBuf.length - 1, Math.floor((freq / nyquist) * this.freqBuf.length));
      const mag = hasSignal ? (this.freqBuf[bin] ?? 0) / 255 : 0;
      const barH = Math.max(2, mag * (h - 14));
      const bx = (i / bars) * w;
      ctx.fillStyle = `hsl(${195 - mag * 145}, 88%, 58%)`;
      ctx.fillRect(bx + 1, h - barH, w / bars - 2, barH);
    }
  }

  private drawTimeline(tracks: readonly SoundTrackSpec[], playProgress: number): void {
    const ctx = this.timelineCanvas.getContext("2d");
    if (!ctx) return;
    const { width: w, height: h } = this.timelineCanvas;
    drawGrid(ctx, w, h);
    const total = totalTracksDurationSec(tracks);
    const audible = new Set(activeStudioTracks(tracks).map((t) => t.id));
    const rowH = Math.max(12, Math.floor((h - 12) / Math.max(1, tracks.length)));
    tracks.forEach((t, idx) => {
      const x = (t.delaySec / total) * (w - 8) + 4;
      const bw = Math.max(6, (t.durationSec / total) * (w - 8));
      const y = 6 + idx * rowH;
      ctx.globalAlpha = audible.has(t.id) ? 0.92 : 0.28;
      ctx.fillStyle = COLORS[t.kind];
      ctx.fillRect(x, y, bw, Math.max(6, rowH - 4));
      ctx.fillStyle = "#f8fafc";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText(`${t.name} (${Math.round(t.f0)}Hz)`, Math.min(w - 110, x + 4), y + Math.min(rowH - 6, 11));
    });
    ctx.globalAlpha = 1;
    if (playProgress > 0 && playProgress < 1) {
      const px = playProgress * (w - 8) + 4;
      ctx.fillStyle = "#facc15";
      ctx.fillRect(px, 0, 2, h);
    }
  }
}
