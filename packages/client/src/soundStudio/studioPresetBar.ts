/** Preset toolbar (* Unsaved, Save, Save As) and full-screen DAW header/visualizer builders. */
import type { LibraryPreset } from "./studioStorage.js";
import type { SoundTrackSpec, TrackKind } from "./studioTypes.js";

export function cloneStudioTracks(tracks: readonly SoundTrackSpec[]): SoundTrackSpec[] {
  return tracks.map((t) => ({ ...t }));
}

export function buildStudioTrackToolbar(opts: {
  readonly onAddTrack: (kind: TrackKind) => void;
  readonly onImportJson: () => void;
  readonly onCopyJson: () => void;
  readonly onCopyGameCode: () => void;
  readonly onExportWav: () => void;
}): HTMLDivElement {
  const bar = document.createElement("div");
  bar.className = "st-bar";
  bar.append(
    makeStudioBtn("+ Swept Noise", () => opts.onAddTrack("sweptNoise")),
    makeStudioBtn("+ Noise Burst", () => opts.onAddTrack("noise")),
    makeStudioBtn("+ Tone Osc", () => opts.onAddTrack("tone")),
    makeStudioBtn("Import JSON", opts.onImportJson),
    makeStudioBtn("Copy JSON", opts.onCopyJson),
    makeStudioBtn("Copy Game Code", opts.onCopyGameCode),
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
  canvas.width = 640;
  canvas.height = 150;
  card.append(lbl, canvas);
  parent.append(card);
  return canvas;
}

export function buildStudioTopBar(): HTMLDivElement {
  const top = document.createElement("div");
  top.className = "st-top";
  const brand = document.createElement("div");
  brand.innerHTML = `<div class="st-brand">Sound Studio</div><div class="st-sub">Multi-Track Procedural Web Audio Synthesizer &amp; Visualizer</div>`;
  const back = document.createElement("a");
  back.className = "st-btn";
  back.href = "/";
  back.textContent = "Back to Game";
  top.append(brand, back);
  return top;
}

export function buildStudioVizRow(): {
  readonly row1: HTMLDivElement; readonly wave: HTMLCanvasElement; readonly spec: HTMLCanvasElement;
} {
  const row1 = document.createElement("div");
  row1.className = "st-viz-row";
  const wave = makeVizCanvas(row1, "Oscilloscope Waveform (Auto-Gain)");
  const spec = makeVizCanvas(row1, "FFT Frequency Spectrum");
  return { row1, wave, spec };
}

const TEXT_INPUT_TYPES = new Set(["text", "number", "search", "email", "url", "password"]);

export function bindStudioSpacebar(onTrigger: () => void): void {
  window.addEventListener("keydown", (e) => {
    const el = e.target as HTMLElement | null;
    const isText = el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(el.type));
    if (e.code !== "Space" || isText) return;
    e.preventDefault();
    e.stopPropagation();
    if (!e.repeat) onTrigger();
  }, { capture: true });
}

export function buildInspectorHeader(opts: {
  readonly titleEl: HTMLElement; readonly toggleBtn: HTMLButtonElement;
}): HTMLDivElement {
  const head = document.createElement("div");
  head.className = "st-inspector-head";
  opts.titleEl.className = "st-viz-title";
  head.append(opts.titleEl, opts.toggleBtn);
  return head;
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
