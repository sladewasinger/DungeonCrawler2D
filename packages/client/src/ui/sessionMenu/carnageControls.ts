import {
  loadCarnageSettings,
  MAX_BLOOD_DROP_INTENSITY,
  MAX_CARNAGE_INTENSITY,
  MAX_CHUNK_LIMIT,
  MAX_STREAK_LIMIT,
  MIN_BLOOD_DROP_INTENSITY,
  MIN_CARNAGE_INTENSITY,
  MIN_CHUNK_LIMIT,
  MIN_STREAK_LIMIT,
  saveCarnageSettings,
  type CarnageSettings,
} from "../../vfx/system/carnageSettings.js";

interface RangeOptions { label: string; minimum: number; maximum: number; value: number; step: number; format: (value: number) => string; change: (value: number) => void; }
interface PercentRangeOptions { label: string; value: number; minimum: number; maximum: number; change: (next: number) => void; }

function createRange({ label, minimum, maximum, value, step, format, change }: RangeOptions): HTMLLabelElement {
  const row = document.createElement("label");
  row.style.cssText = "display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center";
  const text = document.createElement("span");
  text.textContent = label;
  const output = document.createElement("output");
  const input = document.createElement("input");
  input.type = "range";
  input.setAttribute("aria-label", label);
  input.min = String(minimum);
  input.max = String(maximum);
  input.step = String(step);
  input.value = String(value);
  input.style.cssText = "grid-column:1/-1;width:100%;accent-color:#c9414d";
  const update = () => {
    const next = Number(input.value);
    output.value = format(next);
    change(next);
  };
  input.addEventListener("input", update);
  output.value = format(value);
  row.append(text, output, input);
  return row;
}

function createToggle(
  label: string,
  checked: boolean,
  change: (checked: boolean) => void,
): HTMLLabelElement {
  const row = document.createElement("label");
  row.style.cssText =
    "display:flex;justify-content:space-between;gap:8px;align-items:center";
  const text = document.createElement("span");
  text.textContent = label;
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = checked;
  checkbox.setAttribute("aria-label", label);
  checkbox.addEventListener("change", () => change(checkbox.checked));
  row.append(text, checkbox);
  return row;
}

type SaveSettings = (patch: Partial<CarnageSettings>) => void;

export interface CarnageControlGroups {
  readonly blood: HTMLElement[];
  readonly carnage: HTMLElement[];
}

function createCarnageRanges(
  settings: CarnageSettings,
  save: SaveSettings,
): [
  HTMLLabelElement,
  HTMLLabelElement,
  HTMLLabelElement,
  HTMLLabelElement,
] {
  const bloodDrops = percent({ label: "Blood drop intensity", value: settings.bloodDropIntensity, minimum: MIN_BLOOD_DROP_INTENSITY, maximum: MAX_BLOOD_DROP_INTENSITY, change: (value) => save({ bloodDropIntensity: value }) });
  const intensity = percent({ label: "Carnage intensity", value: settings.intensity, minimum: MIN_CARNAGE_INTENSITY, maximum: MAX_CARNAGE_INTENSITY, change: (value) => save({ intensity: value }) });
  const streaks = createRange({ label: "Ground splat streak limit", minimum: MIN_STREAK_LIMIT, maximum: MAX_STREAK_LIMIT, value: settings.streakLimit, step: 1, format: String, change: (value) => save({ streakLimit: value }) });
  const chunks = createRange({ label: "Gore chunk limit", minimum: MIN_CHUNK_LIMIT, maximum: MAX_CHUNK_LIMIT, value: settings.chunkLimit, step: 1, format: String, change: (value) => save({ chunkLimit: value }) });
  return [bloodDrops, intensity, streaks, chunks];
}

function percent({ label, value, minimum, maximum, change }: PercentRangeOptions): HTMLLabelElement {
  return createRange({ label, value: Math.round(value * 100), minimum: minimum * 100, maximum: maximum * 100, step: 5, format: (next) => `${next}%`, change: (next) => change(next / 100) });
}

export function createCarnageControlGroups(): CarnageControlGroups {
  let settings = loadCarnageSettings();
  const save: SaveSettings = (patch) => {
    settings = saveCarnageSettings({ ...settings, ...patch });
  };
  const enabled = createToggle("Carnage Enabled?", settings.enabled, (checked) => {
    save({ enabled: checked });
  });
  const blood = createToggle("Blood Enabled?", settings.bloodEnabled, (checked) => {
    save({ bloodEnabled: checked });
  });
  const [bloodDrops, intensity, streaks, chunks] = createCarnageRanges(settings, save);
  return {
    blood: [blood, bloodDrops],
    carnage: [enabled, intensity, streaks, chunks],
  };
}
