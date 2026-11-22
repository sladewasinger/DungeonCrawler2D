/** Preset toolbar (* Unsaved, Save, Save As) and DAW header/visualizer shell builders. */
import type { LibraryPreset } from "./studioStorage.js";
import type { SoundTrackSpec, TrackKind } from "./studioTypes.js";

export function cloneStudioTracks(tracks: readonly SoundTrackSpec[]): SoundTrackSpec[] {
  return tracks.map((t) => ({ ...t }));
}

export function buildStudioTrackToolbar(opts: {
  readonly onAddTrack: (kind: TrackKind) => void;
  readonly onCopyJson: () => void;
  readonly onExportWav: () => void;
}): HTMLDivElement {
  const bar = document.createElement("div");
  bar.className = "st-bar";
  bar.append(
    makeStudioBtn("+ Swept Noise", () => opts.onAddTrack("sweptNoise")),
    makeStudioBtn("+ Noise Burst", () => opts.onAddTrack("noise")),
    makeStudioBtn("+ Tone Osc", () => opts.onAddTrack("tone")),
    makeStudioBtn("Copy JSON", opts.onCopyJson),
    makeStudioBtn("Export .WAV", opts.onExportWav),
  );
  return bar;
}

export interface PresetBarCallbacks {
  readonly onSelect: (id: string) => void;
  readonly onSave: () => void;
  readonly onSaveAs: (name: string) => void;
  readonly onResetOrDelete: () => void;
}

export function makeStudioBtn(label: string, onClick: () => void, cls = "st-btn"): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = cls;
  b.textContent = label;
  b.addEventListener("click", () => { b.blur(); onClick(); });
  return b;
}

function makeVizCanvas(parent: HTMLDivElement, title: string): HTMLCanvasElement {
  const card = document.createElement("div");
  card.className = "st-viz-card";
  const lbl = document.createElement("div");
  lbl.className = "st-viz-title";
  lbl.textContent = title;
  const canvas = document.createElement("canvas");
  canvas.className = "st-canvas";
  canvas.width = 480;
  canvas.height = 120;
  card.append(lbl, canvas);
  parent.append(card);
  return canvas;
}

export function buildStudioTopBar(opts: {
  readonly loopBtn: HTMLButtonElement;
  readonly onJumpStart: () => void;
  readonly onPlay: () => void;
}): HTMLDivElement {
  const top = document.createElement("div");
  top.className = "st-top";
  const brand = document.createElement("div");
  brand.innerHTML = `<div class="st-brand">Sound Studio</div><div class="st-sub">Multi-Track Procedural Web Audio Synthesizer &amp; Visualizer</div>`;
  const controls = document.createElement("div");
  controls.className = "st-bar";
  const back = document.createElement("a");
  back.className = "st-btn";
  back.href = "/";
  back.textContent = "Back to Game";
  controls.append(
    makeStudioBtn("|<", opts.onJumpStart),
    makeStudioBtn("Play [Space]", opts.onPlay, "st-btn st-btn-play"),
    opts.loopBtn,
    back,
  );
  top.append(brand, controls);
  return top;
}

export function buildStudioVisualizers(readout: HTMLSpanElement): {
  readonly row1: HTMLDivElement; readonly wave: HTMLCanvasElement; readonly spec: HTMLCanvasElement;
  readonly row2: HTMLDivElement; readonly timeline: HTMLCanvasElement;
} {
  const row1 = document.createElement("div");
  row1.className = "st-viz-row";
  const wave = makeVizCanvas(row1, "Oscilloscope Waveform (Auto-Gain)");
  const spec = makeVizCanvas(row1, "FFT Frequency Spectrum");
  const row2 = document.createElement("div");
  row2.className = "st-timeline-card";
  const meta = document.createElement("div");
  meta.className = "st-timeline-meta";
  const title = document.createElement("span");
  title.className = "st-viz-title";
  title.textContent = "Multi-Track Envelope Timeline — drag bars to slide, right edge to resize, ruler to scrub";
  meta.append(title, readout);
  const timeline = document.createElement("canvas");
  timeline.className = "st-timeline-canvas";
  row2.append(meta, timeline);
  return { row1, wave, spec, row2, timeline };
}

function presetTag(p: LibraryPreset): string {
  if (p.isCustom) return " [Custom]";
  return p.isOverride ? " [Saved]" : "";
}

function formatOptionLabel(p: LibraryPreset, isActive: boolean, dirty: boolean): string {
  return `${isActive && dirty ? "* " : ""}${p.name}${presetTag(p)}`;
}

function resetLabelFor(active: LibraryPreset | undefined): string {
  if (active?.isCustom) return "Delete Preset";
  return active?.isOverride ? "Reset Built-In" : "Revert";
}

export class StudioPresetBar {
  readonly el = document.createElement("div");
  private readonly sel = document.createElement("select");
  private readonly dirtyBadge = document.createElement("span");
  private readonly saveAsInput = document.createElement("input");
  private readonly resetBtn: HTMLButtonElement;

  constructor(cb: PresetBarCallbacks) {
    this.el.className = "st-bar";
    this.sel.className = "st-select";
    this.sel.addEventListener("change", () => { this.sel.blur(); cb.onSelect(this.sel.value); });
    this.dirtyBadge.className = "st-dirty-badge";
    this.dirtyBadge.textContent = "* Unsaved";
    this.dirtyBadge.hidden = true;
    this.saveAsInput.type = "text";
    this.saveAsInput.className = "st-save-input";
    this.saveAsInput.placeholder = "New preset name...";
    this.resetBtn = makeStudioBtn("Revert", cb.onResetOrDelete);
    this.el.append(
      this.sel, this.dirtyBadge, makeStudioBtn("Save", cb.onSave, "st-btn st-btn-save"),
      this.saveAsInput, makeStudioBtn("Save As", () => { cb.onSaveAs(this.saveAsInput.value); this.saveAsInput.value = ""; }),
      this.resetBtn,
    );
  }

  refreshList(library: readonly LibraryPreset[], activeId: string, dirty: boolean): void {
    this.sel.replaceChildren();
    for (const p of library) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = formatOptionLabel(p, p.id === activeId, dirty);
      if (p.id === activeId) opt.selected = true;
      this.sel.append(opt);
    }
    this.dirtyBadge.hidden = !dirty;
    this.resetBtn.textContent = resetLabelFor(library.find((p) => p.id === activeId));
  }

  syncDirty(library: readonly LibraryPreset[], activeId: string, dirty: boolean): void {
    this.dirtyBadge.hidden = !dirty;
    const active = library.find((p) => p.id === activeId);
    const opt = Array.from(this.sel.options).find((o) => o.value === activeId);
    if (opt && active) opt.textContent = formatOptionLabel(active, true, dirty);
  }
}
