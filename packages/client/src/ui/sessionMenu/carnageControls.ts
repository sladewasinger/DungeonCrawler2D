import {
  loadCarnageSettings,
  MAX_CARNAGE_INTENSITY,
  MAX_CHUNK_LIMIT,
  MAX_STREAK_LIMIT,
  MIN_CARNAGE_INTENSITY,
  MIN_CHUNK_LIMIT,
  MIN_STREAK_LIMIT,
  saveCarnageSettings,
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

export function createCarnageControls(): HTMLElement[] {
  let settings = loadCarnageSettings();
  const title = document.createElement("h3");
  title.textContent = "Carnage controls";
  title.style.cssText = "margin:8px 0 0;color:#d66b73;font-size:12px";
  const enabled = createToggle("Carnage Enabled?", settings.enabled, (checked) => {
    settings = saveCarnageSettings({ ...settings, enabled: checked });
  });
  const blood = createToggle("Blood Enabled?", settings.bloodEnabled, (checked) => {
    settings = saveCarnageSettings({ ...settings, bloodEnabled: checked });
  });
  const intensity = createRange(
    "Carnage intensity",
    Math.round(MIN_CARNAGE_INTENSITY * 100),
    Math.round(MAX_CARNAGE_INTENSITY * 100),
    Math.round(settings.intensity * 100),
    5,
    (value) => `${value}%`,
    (value) => {
      settings = saveCarnageSettings({ ...settings, intensity: value / 100 });
    },
  );
  const streaks = createRange(
    "Ground splat streak limit", MIN_STREAK_LIMIT, MAX_STREAK_LIMIT,
    settings.streakLimit, 1, String,
    (value) => {
      settings = saveCarnageSettings({ ...settings, streakLimit: value });
    },
  );
  const chunks = createRange(
    "Gore chunk limit", MIN_CHUNK_LIMIT, MAX_CHUNK_LIMIT,
    settings.chunkLimit, 1, String,
    (value) => {
      settings = saveCarnageSettings({ ...settings, chunkLimit: value });
    },
  );
  return [title, enabled, blood, intensity, streaks, chunks];
}
