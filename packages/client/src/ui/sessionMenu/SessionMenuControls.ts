/** Builds the reusable buttons and range rows used by the shared game menu. */
import {
  type LocalPresentationController,
  MAX_BRIGHTNESS,
  MAX_FONT_SCALE,
  MIN_BRIGHTNESS,
  MIN_FONT_SCALE,
} from "./localPresentation.js";
import { createCarnageControlGroups } from "./carnageControls.js";
import { createSettingsSection } from "./settingsSection.js";

const BUTTON_STYLE =
  "width:100%;padding:9px;border:1px solid #757a93;background:#292b40;" +
  "color:#f2f0eb;font:12px monospace;cursor:pointer";

export const createSessionButton = (
  label: string,
  action: () => void,
): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.style.cssText = BUTTON_STYLE;
  button.addEventListener("click", action);
  return button;
};

export const createSessionRange = (
  { label, minimum, maximum, value, change }: { label: string; minimum: number; maximum: number; value: number; change: (value: number) => void },
): HTMLLabelElement => {
  const row = document.createElement("label");
  row.style.cssText = "display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center";
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
  input.style.cssText = "grid-column:1/-1;width:100%;accent-color:#ffd54c";
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
  motion.style.cssText =
    "display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center";
  const motionText = document.createElement("span");
  motionText.textContent = "Interface motion";
  const motionSelect = document.createElement("select");
  motionSelect.setAttribute("aria-label", "Interface motion");
  motionSelect.style.cssText =
    "padding:6px;border:1px solid #757a93;background:#292b40;color:#f2f0eb";
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
  const brightness = createSessionRange({ label: "World brightness", minimum: MIN_BRIGHTNESS, maximum: MAX_BRIGHTNESS, value: current.brightness, change: (value) => presentation.setBrightness(value) });
  const font = createSessionRange({ label: "HUD font scale", minimum: MIN_FONT_SCALE, maximum: MAX_FONT_SCALE, value: current.fontScale, change: (value) => presentation.setFontScale(value) });
  const motion = createMotionControl(presentation, current.motion);
  const groups = createCarnageControlGroups();
  const accessibility = createSettingsSection(
    "Accessibility",
    "#aaaec8",
    [brightness, font, motion],
  );
  accessibility.style.gridColumn = "1 / -1";
  return [
    accessibility,
    createSettingsSection("Blood", "#c9414d", groups.blood),
    createSettingsSection("Carnage", "#d66b73", groups.carnage),
  ];
};
