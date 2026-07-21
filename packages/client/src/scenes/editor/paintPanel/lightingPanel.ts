// The lighting workbench (torch + brightness/contrast + baked-AO tuning):
// sliders drive tileLight.ts's injectable config (and contactShade.ts's AO
// strength) directly, debounce-rebaking the live view, plus a copy-paste-ready
// readout line and a preset row for comparing shipped eras. Nothing here
// persists to the map JSON — this tunes process-wide render config for THIS
// session only, per those modules' own "editor calls it, game never does"
// contracts.
import { getAOStrength, setAOStrength } from "../../../render/terrain/contactShade.js";
import {
  getTileLightConfig,
  setTileLightConfig,
  type TileLightConfig,
} from "../../../render/terrain/tileLight.js";
import type { EditorStore } from "../editorStore.js";
import { button, sectionLabel } from "./domHelpers.js";

const REBAKE_DEBOUNCE_MS = 150;

interface SliderSpec {
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  read(): number;
  write(value: number): void;
}

/** A slider bound to one numeric TileLightConfig field. */
function lightSlider(key: keyof TileLightConfig, label: string, min: number, max: number, step: number): SliderSpec {
  return {
    label,
    min,
    max,
    step,
    read: () => getTileLightConfig()[key],
    // Every slider key is a number field of TileLightConfig — the computed-property
    // literal can't be narrowed from `key` alone, but the union is homogeneous.
    write: (value) => setTileLightConfig({ [key]: value } as Partial<TileLightConfig>),
  };
}

const SLIDERS: readonly SliderSpec[] = [
  lightSlider("ambient", "AMBIENT", 0.2, 1.0, 0.01),
  lightSlider("curveFullLevel", "CURVE_FULL_LEVEL", 4, 12, 0.5),
  lightSlider("warmth", "WARMTH", 0, 1, 0.01),
  // Baked fake-AO contact-shadow strength (render/terrain/contactShade.ts) —
  // same knob pattern, different config module.
  { label: "AO_STRENGTH", min: 0, max: 1, step: 0.01, read: getAOStrength, write: setAOStrength },
];

/** Shipped tunings (docs/ROADMAP.md "brightness round" history), oldest first, so
 * dragging left-to-right across the row walks forward through eras. Eras without a
 * warmth value leave the current warmth untouched; none touch the AO knob. */
const PRESETS: ReadonlyArray<Partial<TileLightConfig>> = [
  { ambient: 0.42, curveFullLevel: 8.5 },
  { ambient: 0.62, curveFullLevel: 7 },
  { ambient: 0.72, curveFullLevel: 7 },
  // Austin's first workbench tuning (2026-07-20) — the current shipped default.
  { ambient: 0.65, curveFullLevel: 4.5, warmth: 0.75 },
];

function debounce(fn: () => void, ms: number): () => void {
  let handle: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (handle !== undefined) clearTimeout(handle);
    handle = setTimeout(fn, ms);
  };
}

function formatValue(spec: SliderSpec, raw: number): string {
  return spec.step >= 1 ? String(raw) : raw.toFixed(2);
}

function formatReadout(): string {
  const cfg = getTileLightConfig();
  return `ambient=${cfg.ambient.toFixed(2)} full=${cfg.curveFullLevel} warmth=${cfg.warmth.toFixed(2)} ao=${getAOStrength().toFixed(2)}`;
}

interface SliderRow {
  readonly spec: SliderSpec;
  readonly row: HTMLDivElement;
  readonly input: HTMLInputElement;
  readonly valueEl: HTMLSpanElement;
}

function buildSliderRow(spec: SliderSpec, onChange: () => void): SliderRow {
  const row = document.createElement("div");
  row.style.cssText = "display:flex;align-items:center;gap:6px;font:11px monospace;color:#c8c8d6;margin:2px 0";
  const labelEl = document.createElement("span");
  labelEl.style.cssText = "flex:0 0 118px";
  labelEl.textContent = spec.label;
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(spec.min);
  input.max = String(spec.max);
  input.step = String(spec.step);
  const current = spec.read();
  input.value = String(current);
  input.style.cssText = "flex:1 1 auto";
  const valueEl = document.createElement("span");
  valueEl.style.cssText = "flex:0 0 40px;text-align:right";
  valueEl.textContent = formatValue(spec, current);
  input.addEventListener("input", () => {
    const value = Number(input.value);
    valueEl.textContent = formatValue(spec, value);
    spec.write(value);
    onChange();
  });
  row.append(labelEl, input, valueEl);
  return { spec, row, input, valueEl };
}

/** Pushes the current config onto every slider's displayed value/handle — used after a
 * preset click, since that changes config without going through a slider's own input event. */
function syncSlidersToConfig(rows: readonly SliderRow[]): void {
  for (const slider of rows) {
    const value = slider.spec.read();
    slider.input.value = String(value);
    slider.valueEl.textContent = formatValue(slider.spec, value);
  }
}

function buildPresetRow(rows: readonly SliderRow[], onChange: () => void): HTMLDivElement {
  const bar = document.createElement("div");
  bar.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;margin-top:4px";
  for (const preset of PRESETS) {
    bar.append(
      button(`${(preset.ambient ?? 0).toFixed(2)} / ${preset.curveFullLevel ?? "-"}`, () => {
        setTileLightConfig(preset);
        syncSlidersToConfig(rows);
        onChange();
      }),
    );
  }
  return bar;
}

/** Builds the LIGHTING section: sliders + preset row + read-only "ambient=… full=…
 * warmth=… ao=…" line Austin can copy-paste back into chat. Live-rebakes the editor's
 * Phaser view on drag (debounced) via `store.notifyLightingChange` — a render-only
 * refresh that never touches the persisted map JSON. */
export function buildLightingPanel(store: EditorStore): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = "margin:8px 0;padding-top:6px;border-top:1px solid #333340";
  const readout = document.createElement("div");
  readout.style.cssText = "font:11px monospace;color:#8f8fa3;margin-top:4px;user-select:all";
  const refreshReadout = () => (readout.textContent = formatReadout());
  const rebake = debounce(() => store.notifyLightingChange(), REBAKE_DEBOUNCE_MS);
  const onChange = () => {
    refreshReadout();
    rebake();
  };

  const rows: SliderRow[] = [];
  wrap.append(sectionLabel("LIGHTING"));
  for (const spec of SLIDERS) {
    const slider = buildSliderRow(spec, onChange);
    rows.push(slider);
    wrap.append(slider.row);
  }
  wrap.append(buildPresetRow(rows, onChange), readout);
  refreshReadout();
  return wrap;
}
