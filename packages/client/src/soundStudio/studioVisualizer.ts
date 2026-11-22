/** High-amplitude Float32 Oscilloscope Waveform and Log-Scale FFT Frequency Spectrum canvases. */

const BG = "#090f17";
const GRID = "rgba(148, 163, 184, 0.14)";
const AXIS_LABELS = ["100", "500", "1k", "4k", "10k"] as const;

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
  private readonly timeBuf = new Float32Array(1024);
  private readonly freqBuf = new Uint8Array(1024);
  private peakHold = 0.08;

  constructor(
    private readonly waveCanvas: HTMLCanvasElement,
    private readonly specCanvas: HTMLCanvasElement,
  ) {}

  drawLive(opts: { readonly sampleRate: number; readonly hasSignal: boolean }): void {
    this.drawWaveform(opts.hasSignal);
    this.drawSpectrum(opts.sampleRate, opts.hasSignal);
  }

  buffers(): { readonly timeBuf: Float32Array<ArrayBuffer>; readonly freqBuf: Uint8Array<ArrayBuffer> } {
    return { timeBuf: this.timeBuf, freqBuf: this.freqBuf };
  }

  private nextPeakScale(hasSignal: boolean): number {
    let maxAbs = 0;
    if (hasSignal) {
      for (const s of this.timeBuf) maxAbs = Math.max(maxAbs, Math.abs(s));
    }
    this.peakHold = hasSignal
      ? Math.max(maxAbs, this.peakHold * 0.93, 0.045)
      : Math.max(0.045, this.peakHold * 0.9);
    return Math.min(14, 0.84 / this.peakHold);
  }

  private drawWaveform(hasSignal: boolean): void {
    const ctx = this.waveCanvas.getContext("2d");
    if (!ctx) return;
    const { width: w, height: h } = this.waveCanvas;
    drawGrid(ctx, w, h);
    const scale = this.nextPeakScale(hasSignal);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(w, h * 0.5);
    ctx.stroke();

    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const idx = Math.floor((x / w) * this.timeBuf.length);
      const val = hasSignal ? Math.max(-1, Math.min(1, (this.timeBuf[idx] ?? 0) * scale)) : 0;
      const y = h * 0.5 - val * (h * 0.44);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = "rgba(52, 211, 153, 0.8)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`×${scale.toFixed(1)} auto-gain`, w - 76, 15);
  }

  private drawSpectrum(sampleRate: number, hasSignal: boolean): void {
    const ctx = this.specCanvas.getContext("2d");
    if (!ctx) return;
    const { width: w, height: h } = this.specCanvas;
    drawGrid(ctx, w, h);
    const bars = 48;
    const nyquist = Math.max(8000, (sampleRate || 44100) / 2);
    const plotH = h - 16;
    for (let i = 0; i < bars; i++) {
      const freq = 60 * Math.pow(nyquist / 120, i / bars);
      const bin = Math.min(this.freqBuf.length - 1, Math.floor((freq / nyquist) * this.freqBuf.length));
      const mag = hasSignal ? (this.freqBuf[bin] ?? 0) / 255 : 0;
      const barH = Math.max(2, mag * (plotH - 6));
      ctx.fillStyle = `hsl(${195 - mag * 145}, 88%, 58%)`;
      ctx.fillRect((i / bars) * w + 1, plotH - barH, w / bars - 2, barH);
    }
    ctx.fillStyle = "rgba(148, 163, 184, 0.72)";
    ctx.font = "10px system-ui, sans-serif";
    AXIS_LABELS.forEach((lbl, idx) => ctx.fillText(lbl, 14 + idx * ((w - 48) / 4), h - 4));
  }
}
