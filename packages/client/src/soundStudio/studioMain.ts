/** Entry script for standalone local multi-track Sound Studio (/sound-studio.html). */
import { STUDIO_PRESETS } from "./studioPresets.js";
import { ensureStudioStyles } from "./studioStyles.js";
import { StudioSynthEngine, totalTracksDurationSec } from "./studioSynth.js";
import { createDefaultTrack, type SoundTrackSpec, type TrackKind } from "./studioTypes.js";
import { StudioVisualizer } from "./studioVisualizer.js";
import { renderTrackCard } from "./trackRowUi.js";

class SoundStudioApp {
  private readonly synth = new StudioSynthEngine();
  private readonly viz: StudioVisualizer;
  private readonly tracksHost = document.createElement("div");
  private readonly descEl = document.createElement("div");
  private readonly statusEl = document.createElement("div");
  private readonly loopBtn: HTMLButtonElement;
  private tracks: SoundTrackSpec[] = [...STUDIO_PRESETS[0]!.tracks];
  private presetName: string = STUDIO_PRESETS[0]!.name;
  private looping = false;
  private playStartMs = 0;
  private playDurMs = 0;
  private loopTimer: number | null = null;
  private nextId = 1;

  constructor(host: HTMLElement) {
    ensureStudioStyles();
    const shell = document.createElement("div");
    shell.className = "st-shell";
    const canvases = this.buildVisualizers();
    this.viz = new StudioVisualizer(canvases.wave, canvases.spec, canvases.timeline);
    this.loopBtn = this.makeBtn("Loop: Off", () => this.toggleLoop());
    this.tracksHost.className = "st-tracks";
    this.descEl.className = "st-sub";
    this.descEl.textContent = STUDIO_PRESETS[0]!.description;
    this.statusEl.className = "st-status";
    shell.append(this.buildTopBar(), this.descEl, canvases.grid, this.buildTrackToolbar(), this.statusEl, this.tracksHost);
    host.append(shell);
    this.renderTracks();
    this.bindKeys();
    this.startVisualizerLoop();
  }

  private makeBtn(label: string, onClick: () => void, extra = ""): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = extra ? `st-btn ${extra}` : "st-btn";
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  private buildTopBar(): HTMLDivElement {
    const top = document.createElement("div");
    top.className = "st-top";
    const brand = document.createElement("div");
    brand.innerHTML = `<div class="st-brand">Sound Studio</div><div class="st-sub">Multi-Track Procedural Web Audio Synthesizer & Visualizer</div>`;
    const controls = document.createElement("div");
    controls.className = "st-bar";
    const back = document.createElement("a");
    back.className = "st-btn";
    back.href = "/";
    back.textContent = "Back to Game";
    controls.append(this.buildPresetSelect(), this.makeBtn("Play [Space]", () => this.triggerPlay(), "st-btn-play"), this.loopBtn, back);
    top.append(brand, controls);
    return top;
  }

  private buildPresetSelect(): HTMLSelectElement {
    const sel = document.createElement("select");
    sel.className = "st-select";
    for (const p of STUDIO_PRESETS) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      sel.append(opt);
    }
    sel.addEventListener("change", () => this.loadPreset(sel.value));
    return sel;
  }

  private buildVisualizers(): { readonly grid: HTMLDivElement; readonly wave: HTMLCanvasElement; readonly spec: HTMLCanvasElement; readonly timeline: HTMLCanvasElement } {
    const grid = document.createElement("div");
    grid.className = "st-viz-grid";
    const wave = this.makeVizCard(grid, "Oscilloscope Waveform");
    const spec = this.makeVizCard(grid, "FFT Frequency Spectrum");
    const timeline = this.makeVizCard(grid, "Multi-Track Envelope Timeline");
    return { grid, wave, spec, timeline };
  }

  private makeVizCard(parent: HTMLDivElement, title: string): HTMLCanvasElement {
    const card = document.createElement("div");
    card.className = "st-viz-card";
    const lbl = document.createElement("div");
    lbl.className = "st-viz-title";
    lbl.textContent = title;
    const canvas = document.createElement("canvas");
    canvas.className = "st-canvas";
    canvas.width = 360;
    canvas.height = 110;
    card.append(lbl, canvas);
    parent.append(card);
    return canvas;
  }

  private buildTrackToolbar(): HTMLDivElement {
    const bar = document.createElement("div");
    bar.className = "st-bar";
    bar.append(
      this.makeBtn("+ Swept Noise", () => this.addTrack("sweptNoise")),
      this.makeBtn("+ Noise Burst", () => this.addTrack("noise")),
      this.makeBtn("+ Tone Osc", () => this.addTrack("tone")),
      this.makeBtn("Copy JSON", () => void this.copyPresetJson()),
      this.makeBtn("Export .WAV", () => void this.downloadWav()),
    );
    return bar;
  }

  private loadPreset(id: string): void {
    const found = STUDIO_PRESETS.find((p) => p.id === id);
    if (!found) return;
    this.presetName = found.name;
    this.descEl.textContent = found.description;
    this.tracks = found.tracks.map((t) => ({ ...t }));
    this.renderTracks();
    this.triggerPlay();
  }

  private addTrack(kind: TrackKind): void {
    this.tracks = [...this.tracks, createDefaultTrack(kind, this.nextId++)];
    this.renderTracks();
  }

  private triggerPlay(): void {
    const durSec = this.synth.play(this.tracks);
    this.playStartMs = performance.now();
    this.playDurMs = durSec * 1000;
  }

  private toggleLoop(): void {
    this.looping = !this.looping;
    this.loopBtn.textContent = this.looping ? "Loop: On" : "Loop: Off";
    this.loopBtn.dataset.active = String(this.looping);
    if (this.loopTimer !== null) { window.clearInterval(this.loopTimer); this.loopTimer = null; }
    if (!this.looping) return;
    this.triggerPlay();
    this.loopTimer = window.setInterval(() => {
      if (performance.now() - this.playStartMs >= totalTracksDurationSec(this.tracks) * 1000 + 280) this.triggerPlay();
    }, 120);
  }

  private async copyPresetJson(): Promise<void> {
    const payload = JSON.stringify({ name: this.presetName, tracks: this.tracks }, null, 2);
    await navigator.clipboard?.writeText(payload).catch(() => {});
    this.statusEl.textContent = "Copied preset JSON layers to clipboard.";
  }

  private async downloadWav(): Promise<void> {
    const blob = await this.synth.renderWavBlob(this.tracks);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${this.presetName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.wav`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.statusEl.textContent = "Exported mono 16-bit PCM .WAV render.";
  }

  private renderTracks(): void {
    this.tracksHost.replaceChildren();
    for (const track of this.tracks) {
      const card = renderTrackCard(track, {
        onUpdate: (next) => {
          this.tracks = this.tracks.map((t) => (t.id === next.id ? next : t));
          if (next.kind !== track.kind || next.solo !== track.solo || next.enabled !== track.enabled) this.renderTracks();
        },
        onClone: (id) => {
          const src = this.tracks.find((t) => t.id === id);
          if (!src) return;
          this.tracks = [...this.tracks, { ...src, id: `trk-c-${this.nextId++}`, name: `${src.name} Copy` }];
          this.renderTracks();
        },
        onDelete: (id) => {
          if (this.tracks.length <= 1) return;
          this.tracks = this.tracks.filter((t) => t.id !== id);
          this.renderTracks();
        },
      });
      this.tracksHost.append(card);
    }
  }

  private bindKeys(): void {
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" && (e.target as HTMLElement | null)?.tagName !== "INPUT") {
        e.preventDefault();
        this.triggerPlay();
      }
    });
  }

  private startVisualizerLoop(): void {
    const { timeBuf, freqBuf } = this.viz.buffers();
    const tick = (): void => {
      const sampleRate = this.synth.sampleAnalyser(timeBuf, freqBuf);
      const elapsed = performance.now() - this.playStartMs;
      const playing = this.playDurMs > 0 && elapsed < this.playDurMs;
      const playProgress = playing ? elapsed / this.playDurMs : 0;
      this.viz.drawLive({ sampleRate, tracks: this.tracks, hasSignal: sampleRate > 0 && playing, playProgress });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

const host = document.getElementById("studio-app");
if (host) new SoundStudioApp(host);
