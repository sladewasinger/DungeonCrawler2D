/** Patch-only DAW track card UI builder with synced sliders + numeric inputs (zero stale closures). */
import type { NoiseColor, SoundTrackSpec, TrackKind } from "./studioTypes.js";

export interface TrackRowCallbacks {
  readonly onPatch: (id: string, patch: Partial<SoundTrackSpec>) => void;
  readonly onToggle: (id: string, field: "enabled" | "solo") => void;
  readonly onClone: (id: string) => void;
  readonly onDelete: (id: string) => void;
}

interface RangeDescriptor {
  readonly label: string;
  readonly field: "f0" | "f1" | "q" | "delaySec" | "durationSec" | "attackSec" | "holdSec" | "gain" | "pan";
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly scale: number;
  readonly decimals: number;
}

const KINDS: readonly TrackKind[] = ["noise", "sweptNoise", "tone", "vocal"];
const WAVES: readonly OscillatorType[] = ["sine", "triangle", "square", "sawtooth"];
const FILTERS: readonly BiquadFilterType[] = ["lowpass", "bandpass", "highpass"];
const NOISE_COLORS: readonly NoiseColor[] = ["white", "pink", "brown"];

const RANGE_DESCRIPTORS: readonly RangeDescriptor[] = [
  { label: "Start Hz", field: "f0", min: 20, max: 10000, step: 5, scale: 1, decimals: 0 },
  { label: "End Hz", field: "f1", min: 20, max: 10000, step: 5, scale: 1, decimals: 0 },
  { label: "Res Q", field: "q", min: 0.2, max: 10, step: 0.05, scale: 1, decimals: 2 },
  { label: "Delay ms", field: "delaySec", min: 0, max: 3000, step: 5, scale: 1000, decimals: 0 },
  { label: "Dur ms", field: "durationSec", min: 20, max: 3000, step: 5, scale: 1000, decimals: 0 },
  { label: "Attack ms", field: "attackSec", min: 2, max: 1000, step: 2, scale: 1000, decimals: 0 },
  { label: "Hold ms", field: "holdSec", min: 0, max: 2500, step: 5, scale: 1000, decimals: 0 },
  { label: "Gain", field: "gain", min: 0.01, max: 0.85, step: 0.01, scale: 1, decimals: 2 },
  { label: "Pan", field: "pan", min: -1, max: 1, step: 0.05, scale: 1, decimals: 2 },
];

function makeBtn(label: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = cls;
  b.textContent = label;
  b.addEventListener("click", () => { b.blur(); onClick(); });
  return b;
}

function createBoundInput(type: "range" | "number", desc: RangeDescriptor, uiInit: number): HTMLInputElement {
  const inp = document.createElement("input");
  inp.type = type;
  if (type === "number") inp.className = "st-num";
  inp.min = String(desc.min);
  inp.max = String(desc.max);
  inp.step = String(desc.step);
  inp.value = type === "number" ? uiInit.toFixed(desc.decimals) : String(uiInit);
  return inp;
}

function makeRangeField(desc: RangeDescriptor, rawVal: number, onValue: (nextRaw: number) => void): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "st-field";
  wrap.dataset.field = desc.field;
  const head = document.createElement("div");
  head.className = "st-field-head";
  const lbl = document.createElement("span");
  lbl.textContent = desc.label;

  const uiInit = rawVal * desc.scale;
  const num = createBoundInput("number", desc, uiInit);
  const range = createBoundInput("range", desc, uiInit);
  range.addEventListener("input", () => {
    const v = Number(range.value);
    num.value = v.toFixed(desc.decimals);
    onValue(v / desc.scale);
  });
  range.addEventListener("change", () => range.blur());
  range.addEventListener("pointerup", () => range.blur());
  num.addEventListener("change", () => {
    const clamped = Math.max(desc.min, Math.min(desc.max, Number(num.value) || desc.min));
    num.value = clamped.toFixed(desc.decimals);
    range.value = String(clamped);
    onValue(clamped / desc.scale);
  });
  head.append(lbl, num);
  wrap.append(head, range);
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
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "st-name";
  nameInput.value = t.name;
  nameInput.addEventListener("input", () => cb.onPatch(t.id, { name: nameInput.value }));

  const actions = document.createElement("div");
  actions.className = "st-bar";
  const muteBtn = makeBtn(t.enabled ? "Active" : "Muted", "st-btn", () => cb.onToggle(t.id, "enabled"));
  muteBtn.dataset.active = String(!t.enabled);
  const soloBtn = makeBtn("Solo", "st-btn", () => cb.onToggle(t.id, "solo"));
  soloBtn.dataset.active = String(t.solo);
  actions.append(
    muteBtn, soloBtn,
    makeBtn("Clone", "st-btn", () => cb.onClone(t.id)),
    makeBtn("Delete", "st-btn st-btn-danger", () => cb.onDelete(t.id)),
  );
  head.append(nameInput, actions);
  return head;
}

function buildParameterGrid(t: SoundTrackSpec, onPatch: TrackRowCallbacks["onPatch"]): HTMLDivElement {
  const grid = document.createElement("div");
  grid.className = "st-grid";
  grid.append(makeSelectField({ label: "Engine", options: KINDS, value: t.kind, onChange: (v) => onPatch(t.id, { kind: v as TrackKind }) }));
  if (t.kind === "tone" || t.kind === "vocal") {
    grid.append(makeSelectField({ label: "Wave", options: WAVES, value: t.wave, onChange: (v) => onPatch(t.id, { wave: v as OscillatorType }) }));
  }
  if (t.kind !== "tone") {
    grid.append(
      makeSelectField({ label: "Filter", options: FILTERS, value: t.filterType, onChange: (v) => onPatch(t.id, { filterType: v as BiquadFilterType }) }),
      makeSelectField({ label: "Noise", options: NOISE_COLORS, value: t.noiseColor, onChange: (v) => onPatch(t.id, { noiseColor: v as NoiseColor }) }),
    );
  }
  for (const desc of RANGE_DESCRIPTORS) {
    grid.append(makeRangeField(desc, t[desc.field], (val) => onPatch(t.id, { [desc.field]: val })));
  }
  return grid;
}

export function syncTrackCardTimingField(host: HTMLElement, opts: {
  readonly id: string; readonly field: "delaySec" | "durationSec" | "gain"; readonly rawVal: number;
}): void {
  const wrap = host.querySelector(`[data-track-id="${opts.id}"] [data-field="${opts.field}"]`);
  if (!wrap) return;
  const desc = RANGE_DESCRIPTORS.find((d) => d.field === opts.field);
  if (!desc) return;
  const uiVal = opts.rawVal * desc.scale;
  const range = wrap.querySelector<HTMLInputElement>("input[type=\"range\"]");
  const num = wrap.querySelector<HTMLInputElement>("input[type=\"number\"]");
  if (range && document.activeElement !== range) range.value = String(uiVal);
  if (num && document.activeElement !== num) num.value = uiVal.toFixed(desc.decimals);
}

export function syncAllTrackTimings(host: HTMLElement, tracks: readonly SoundTrackSpec[]): void {
  for (const t of tracks) {
    syncTrackCardTimingField(host, { id: t.id, field: "delaySec", rawVal: t.delaySec });
    syncTrackCardTimingField(host, { id: t.id, field: "durationSec", rawVal: t.durationSec });
  }
}

export function renderTrackInspectorList(host: HTMLElement, opts: {
  readonly tracks: readonly SoundTrackSpec[]; readonly selectedId: string;
  readonly showAll: boolean; readonly callbacks: TrackRowCallbacks;
}): void {
  const visible = opts.showAll ? opts.tracks : opts.tracks.filter((t) => t.id === opts.selectedId);
  host.replaceChildren();
  for (const track of visible) {
    host.append(renderTrackCard(track, opts.callbacks, track.id === opts.selectedId));
  }
}

export function renderTrackCard(track: SoundTrackSpec, callbacks: TrackRowCallbacks, selected: boolean): HTMLDivElement {
  const card = document.createElement("div");
  card.className = "st-track";
  card.dataset.trackId = track.id;
  card.dataset.selected = String(selected);
  card.append(buildHeader(track, callbacks), buildParameterGrid(track, callbacks.onPatch));
  return card;
}
