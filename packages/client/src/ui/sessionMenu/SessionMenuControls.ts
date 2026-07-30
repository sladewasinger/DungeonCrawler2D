/** Builds the reusable buttons and range rows used by the shared game menu. */
import {
  type LocalPresentationController,
  MAX_BRIGHTNESS,
  MAX_FONT_SCALE,
  MIN_BRIGHTNESS,
  MIN_FONT_SCALE,
} from "./localPresentation.js";
import { createCarnageControlGroups } from "./carnageControls.js";
import {
  createDevicePerformanceControl,
} from "./performance/devicePerformanceControl.js";
import { createSettingsSection } from "./settingsSection.js";
import { createHudTemplate } from "../hud/styles/hudTemplate.js";
import {
  currentLightingMode,
  LIGHTING_MODES,
  lightingModeIsQueryForced,
  savePersistedLightingMode,
} from "../../render/lighting/mode.js";
export const createSessionButton = (
  label: string,
  action: () => void,
): HTMLButtonElement => {
  const button = createHudTemplate<HTMLButtonElement>("hud-button-template");
  button.classList.add("hud-session__button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", action);
  return button;
};
export const createSessionRange = (
  { label, minimum, maximum, value, change }: { label: string; minimum: number; maximum: number; value: number; change: (value: number) => void },
): HTMLLabelElement => {
  const row = document.createElement("label");
  row.className = "hud-session__range";
  const text = document.createElement("span");
  text.textContent = label;
  const output = document.createElement("output");
  const input = document.createElement("input");
  input.type = "range";
  input.setAttribute("aria-label", label);
  input.min = String(Math.round(minimum * 100));
  input.max = String(Math.round(maximum * 100));
  input.step = "5";
  input.value = String(Math.round(value * 100));
  input.className = "hud-session__range-input";
  bindRangeInput(input, output, change);
  output.value = `${Math.round(value * 100)}%`;
  row.append(text, output, input);
  return row;
};
function bindRangeInput(input: HTMLInputElement, output: HTMLOutputElement, change: (value: number) => void): void {
  input.addEventListener("input", () => {
    const next = Number(input.value) / 100;
    output.value = `${Math.round(next * 100)}%`;
    change(next);
  });
}

const createMotionControl = (
  presentation: LocalPresentationController,
  currentMotion: "system" | "reduce" | "full",
): HTMLLabelElement => {
  const motion = document.createElement("label");
  motion.className = "hud-session__motion";
  const motionText = document.createElement("span");
  motionText.textContent = "Interface motion";
  const motionSelect = document.createElement("select");
  motionSelect.setAttribute("aria-label", "Interface motion");
  motionSelect.className = "hud-session__select";
  addMotionOptions(motionSelect);
  motionSelect.value = currentMotion;
  bindMotionChange(motionSelect, presentation);
  motion.append(motionText, motionSelect);
  return motion;
};

function addMotionOptions(select: HTMLSelectElement): void {
  for (const [value, label] of [["system", "Follow device"], ["reduce", "Reduce"], ["full", "Full"]] as const) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
}

function bindMotionChange(select: HTMLSelectElement, presentation: LocalPresentationController): void {
  select.addEventListener("change", () => presentation.setMotion(
    select.value === "reduce" || select.value === "full" ? select.value : "system",
  ));
}

export const createGraphicsControls = (
  presentation: LocalPresentationController,
): HTMLElement[] => {
  const current = presentation.current();
  const brightness = createSessionRange({
    label: "World brightness",
    minimum: MIN_BRIGHTNESS,
    maximum: MAX_BRIGHTNESS,
    value: current.brightness,
    change: (value) => presentation.setBrightness(value),
  });
  const font = createSessionRange({
    label: "HUD font scale",
    minimum: MIN_FONT_SCALE,
    maximum: MAX_FONT_SCALE,
    value: current.fontScale,
    change: (value) => presentation.setFontScale(value),
  });
  const motion = createMotionControl(presentation, current.motion);
  const performance = createDevicePerformanceControl();
  const lighting = createLightingModeControl();
  const groups = createCarnageControlGroups();
  const accessibility = createSettingsSection(
    "Accessibility",
    "#aaaec8",
    [brightness, font, motion, performance, lighting],
  );
  accessibility.style.gridColumn = "1 / -1";
  return [
    accessibility,
    createSettingsSection("Blood", "#c9414d", groups.blood),
    createSettingsSection("Carnage", "#d66b73", groups.carnage),
  ];
};

function createLightingModeControl(): HTMLButtonElement {
  const queryForced = lightingModeIsQueryForced();
  const button = createSessionButton(lightingModeLabel(queryForced), () => {
    const next = currentLightingMode() === LIGHTING_MODES.Toon
      ? LIGHTING_MODES.Classic
      : LIGHTING_MODES.Toon;
    savePersistedLightingMode(next);
    button.textContent = lightingModeLabel(false);
  });
  button.disabled = queryForced;
  if (queryForced) {
    button.title = "The lighting URL parameter overrides this setting for this load.";
  }
  return button;
}

function lightingModeLabel(queryForced: boolean): string {
  const mode = currentLightingMode() === LIGHTING_MODES.Toon
    ? "Toon LOS"
    : "Classic";
  return queryForced
    ? `Lighting: ${mode} (URL)`
    : `Lighting: ${mode}`;
}
