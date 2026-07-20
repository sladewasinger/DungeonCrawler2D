// The lighting workbench (torch + brightness/contrast tuning): three sliders drive
// tileLight.ts's injectable config directly, debounce-rebaking the live view, plus a
// copy-paste-ready readout line and a preset row for comparing shipped eras. Nothing
// here persists to the map JSON — this tunes render/terrain/tileLight.ts's process-wide
// config for THIS session only, per that module's own "editor calls it, game never
// does" contract.
import {
  getTileLightConfig,
  setTileLightConfig,
  type TileLightConfig,
} from "../../../render/terrain/tileLight.js";
import type { EditorStore } from "../editorStore.js";
import { button, sectionLabel } from "./domHelpers.js";

const REBAKE_DEBOUNCE_MS = 150;

interface SliderSpec {
  readonly key: keyof TileLightConfig;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

const SLIDERS: readonly SliderSpec[] = [
  { key: "ambient", label: "AMBIENT", min: 0.2, max: 1.0, step: 0.01 },
  { key: "curveFullLevel", label: "CURVE_FULL_LEVEL", min: 4, max: 12, step: 0.5 },
  { key: "warmth", label: "WARMTH", min: 0, max: 1, step: 0.01 },
];

/** The last three shipped tunings (docs/ROADMAP.md "brightness round" history), oldest
 * first, so dragging left-to-right across the row walks forward through eras. Warmth
 * isn't part of any shipped era yet, so presets leave it untouched. */
const PRESETS: ReadonlyArray<Pick<TileLightConfig, "ambient" | "curveFullLevel">> = [
  { ambient: 0.42, curveFullLevel: 8.5 },
  { ambient: 0.62, curveFullLevel: 7 },
  { ambient: 0.72, curveFullLevel: 7 },
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

function formatReadout(cfg: TileLightConfig): string {
  return `ambient=${cfg.ambient.toFixed(2)} full=${cfg.curveFullLevel} warmth=${cfg.warmth.toFixed(2)}`;
}

interface SliderRow {
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
  const current = getTileLightConfig()[spec.key];
  input.value = String(current);
  input.style.cssText = "flex:1 1 auto";
  const valueEl = document.createElement("span");
  valueEl.style.cssText = "flex:0 0 40px;text-align:right";
  valueEl.textContent = formatValue(spec, current);
  input.addEventListener("input", () => {
    const value = Number(input.value);
    valueEl.textContent = formatValue(spec, value);
    // Every slider key is a number field of TileLightConfig — the computed-property
    // literal can't be narrowed from `spec.key` alone, but the union is homogeneous.
    setTileLightConfig({ [spec.key]: value } as Partial<TileLightConfig>);
    onChange();
  });
  row.append(labelEl, input, valueEl);
  return { row, input, valueEl };
}

/** Pushes the current config onto every slider's displayed value/handle — used after a
 * preset click, since that changes config without going through a slider's own input event. */
function syncSlidersToConfig(rows: ReadonlyMap<keyof TileLightConfig, SliderRow>): void {
  const cfg = getTileLightConfig();
  for (const spec of SLIDERS) {
    const slider = rows.get(spec.key);
    if (!slider) continue;
    const value = cfg[spec.key];
    slider.input.value = String(value);
    slider.valueEl.textContent = formatValue(spec, value);
  }
}

function buildPresetRow(rows: ReadonlyMap<keyof TileLightConfig, SliderRow>, onChange: () => void): HTMLDivElement {
  const bar = document.createElement("div");
  bar.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;margin-top:4px";
  for (const preset of PRESETS) {
    bar.append(
      button(`${preset.ambient.toFixed(2)} / ${preset.curveFullLevel}`, () => {
        setTileLightConfig(preset);
        syncSlidersToConfig(rows);
        onChange();
      }),
    );
  }
  return bar;
}

/** Builds the LIGHTING section: sliders + preset row + read-only "ambient=… full=…
 * warmth=…" line Austin can copy-paste back into chat. Live-rebakes the editor's Phaser
 * view on drag (debounced) via `store.notifyLightingChange` — a render-only refresh
 * that never touches the persisted map JSON. */
export function buildLightingPanel(store: EditorStore): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = "margin:8px 0;padding-top:6px;border-top:1px solid #333340";
  const readout = document.createElement("div");
  readout.style.cssText = "font:11px monospace;color:#8f8fa3;margin-top:4px;user-select:all";
  const refreshReadout = () => (readout.textContent = formatReadout(getTileLightConfig()));
  const rebake = debounce(() => store.notifyLightingChange(), REBAKE_DEBOUNCE_MS);
  const onChange = () => {
    refreshReadout();
    rebake();
  };

  const rows = new Map<keyof TileLightConfig, SliderRow>();
  wrap.append(sectionLabel("LIGHTING"));
  for (const spec of SLIDERS) {
    const slider = buildSliderRow(spec, onChange);
    rows.set(spec.key, slider);
    wrap.append(slider.row);
  }
  wrap.append(buildPresetRow(rows, onChange), readout);
  refreshReadout();
  return wrap;
}
