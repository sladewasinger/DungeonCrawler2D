/** Patch-only DAW track card UI builder for Sound Studio layers (zero stale-closure spreads). */
import type { SoundTrackSpec, TrackKind } from "./studioTypes.js";

export interface TrackRowCallbacks {
  readonly onPatch: (id: string, patch: Partial<SoundTrackSpec>) => void;
  readonly onToggle: (id: string, field: "enabled" | "solo") => void;
  readonly onClone: (id: string) => void;
  readonly onDelete: (id: string) => void;
}

const KINDS: readonly TrackKind[] = ["noise", "sweptNoise", "tone"];
const WAVES: readonly OscillatorType[] = ["sine", "triangle", "square", "sawtooth"];
const FILTERS: readonly BiquadFilterType[] = ["lowpass", "bandpass", "highpass"];

function makeBtn(label: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = cls;
  b.textContent = label;
  b.addEventListener("click", () => { b.blur(); onClick(); });
  return b;
}

function makeRangeField(opts: {
  readonly label: string; readonly min: number; readonly max: number; readonly step: number;
  readonly value: number; readonly format: (v: number) => string; readonly onChange: (v: number) => void;
  readonly fieldKey?: string;
}): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "st-field";
  if (opts.fieldKey) wrap.dataset.field = opts.fieldKey;
  const lbl = document.createElement("span");
  lbl.textContent = `${opts.label}: ${opts.format(opts.value)}`;
  const inp = document.createElement("input");
  inp.type = "range";
  inp.min = String(opts.min);
  inp.max = String(opts.max);
  inp.step = String(opts.step);
  inp.value = String(opts.value);
  inp.addEventListener("input", () => {
    const v = Number(inp.value);
    lbl.textContent = `${opts.label}: ${opts.format(v)}`;
    opts.onChange(v);
  });
  wrap.append(lbl, inp);
  return wrap;
}

function makeSelectField(opts: {
  readonly label: string; readonly options: readonly string[];
  readonly value: string; readonly onChange: (v: string) => void;
}): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "st-field";
  const lbl = document.createElement("span");
  lbl.textContent = opts.label;
  const sel = document.createElement("select");
  sel.className = "st-select";
  for (const opt of opts.options) {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt;
    if (opt === opts.value) o.selected = true;
    sel.append(o);
  }
  sel.addEventListener("change", () => { sel.blur(); opts.onChange(sel.value); });
  wrap.append(lbl, sel);
  return wrap;
}

function buildHeader(t: SoundTrackSpec, cb: TrackRowCallbacks): HTMLDivElement {
  const head = document.createElement("div");
  head.className = "st-track-head";
  const left = document.createElement("div");
  left.className = "st-bar";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "st-name";
  nameInput.value = t.name;
  nameInput.addEventListener("input", () => cb.onPatch(t.id, { name: nameInput.value }));
  left.append(nameInput);

  const actions = document.createElement("div");
  actions.className = "st-bar";
  const muteBtn = makeBtn(t.enabled ? "Active" : "Muted", "st-btn", () => cb.onToggle(t.id, "enabled"));
  muteBtn.dataset.active = String(!t.enabled);
  const soloBtn = makeBtn("Solo", "st-btn", () => cb.onToggle(t.id, "solo"));
  soloBtn.dataset.active = String(t.solo);
  actions.append(
    muteBtn,
    soloBtn,
    makeBtn("Clone", "st-btn", () => cb.onClone(t.id)),
    makeBtn("Delete", "st-btn st-btn-danger", () => cb.onDelete(t.id)),
  );
  head.append(left, actions);
  return head;
}

function buildParameterGrid(t: SoundTrackSpec, onPatch: TrackRowCallbacks["onPatch"]): HTMLDivElement {
  const grid = document.createElement("div");
  grid.className = "st-grid";
  const id = t.id;
  const modePick = t.kind === "tone"
    ? makeSelectField({ label: "Wave", options: WAVES, value: t.wave, onChange: (v) => onPatch(id, { wave: v as OscillatorType }) })
    : makeSelectField({ label: "Filter", options: FILTERS, value: t.filterType, onChange: (v) => onPatch(id, { filterType: v as BiquadFilterType }) });
  grid.append(
    makeSelectField({ label: "Engine", options: KINDS, value: t.kind, onChange: (v) => onPatch(id, { kind: v as TrackKind }) }),
    modePick,
    makeRangeField({ label: "Start Hz", min: 30, max: 4500, step: 5, value: t.f0, format: (v) => `${Math.round(v)}`, onChange: (v) => onPatch(id, { f0: v }) }),
    makeRangeField({ label: "End Hz", min: 30, max: 4500, step: 5, value: t.f1, format: (v) => `${Math.round(v)}`, onChange: (v) => onPatch(id, { f1: v }) }),
    makeRangeField({ label: "Res Q", min: 0.2, max: 8, step: 0.05, value: t.q, format: (v) => v.toFixed(2), onChange: (v) => onPatch(id, { q: v }) }),
    makeRangeField({ label: "Delay ms", fieldKey: "delaySec", min: 0, max: 900, step: 5, value: t.delaySec * 1000, format: (v) => `${Math.round(v)}`, onChange: (v) => onPatch(id, { delaySec: v / 1000 }) }),
    makeRangeField({ label: "Dur ms", fieldKey: "durationSec", min: 20, max: 900, step: 5, value: t.durationSec * 1000, format: (v) => `${Math.round(v)}`, onChange: (v) => onPatch(id, { durationSec: v / 1000 }) }),
    makeRangeField({ label: "Attack ms", min: 4, max: 200, step: 2, value: t.attackSec * 1000, format: (v) => `${Math.round(v)}`, onChange: (v) => onPatch(id, { attackSec: v / 1000 }) }),
    makeRangeField({ label: "Gain", min: 0.01, max: 0.65, step: 0.01, value: t.gain, format: (v) => v.toFixed(2), onChange: (v) => onPatch(id, { gain: v }) }),
  );
  return grid;
}

export function syncTrackCardTimingField(host: HTMLElement, opts: {
  readonly id: string; readonly field: "delaySec" | "durationSec"; readonly valueSec: number;
}): void {
  const wrap = host.querySelector(`[data-track-id="${opts.id}"] [data-field="${opts.field}"]`);
  if (!wrap) return;
  const ms = Math.round(opts.valueSec * 1000);
  const lbl = wrap.querySelector("span");
  const inp = wrap.querySelector("input");
  if (lbl) lbl.textContent = `${opts.field === "delaySec" ? "Delay ms" : "Dur ms"}: ${ms}`;
  if (inp) inp.value = String(ms);
}

export function renderTrackCard(track: SoundTrackSpec, callbacks: TrackRowCallbacks): HTMLDivElement {
  const card = document.createElement("div");
  card.className = "st-track";
  card.dataset.trackId = track.id;
  card.append(buildHeader(track, callbacks), buildParameterGrid(track, callbacks.onPatch));
  return card;
}
