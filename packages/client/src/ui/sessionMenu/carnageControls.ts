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
} from "../../vfx/carnageSettings.js";

function createRange(
  label: string,
  minimum: number,
  maximum: number,
  value: number,
  step: number,
  format: (value: number) => string,
  change: (value: number) => void,
): HTMLLabelElement {
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
  const bloodDrops = createRange(
    "Blood drop intensity",
    Math.round(MIN_BLOOD_DROP_INTENSITY * 100),
    Math.round(MAX_BLOOD_DROP_INTENSITY * 100),
    Math.round(settings.bloodDropIntensity * 100),
    5,
    (value) => `${value}%`,
    (value) => save({ bloodDropIntensity: value / 100 }),
  );
  const intensity = createRange(
    "Carnage intensity",
    Math.round(MIN_CARNAGE_INTENSITY * 100),
    Math.round(MAX_CARNAGE_INTENSITY * 100),
    Math.round(settings.intensity * 100),
    5,
    (value) => `${value}%`,
    (value) => save({ intensity: value / 100 }),
  );
  const streaks = createRange(
    "Ground splat streak limit", MIN_STREAK_LIMIT, MAX_STREAK_LIMIT,
    settings.streakLimit, 1, String,
    (value) => save({ streakLimit: value }),
  );
  const chunks = createRange(
    "Gore chunk limit", MIN_CHUNK_LIMIT, MAX_CHUNK_LIMIT,
    settings.chunkLimit, 1, String,
    (value) => save({ chunkLimit: value }),
  );
  return [bloodDrops, intensity, streaks, chunks];
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
