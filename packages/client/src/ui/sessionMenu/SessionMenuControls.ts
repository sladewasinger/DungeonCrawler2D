/** Builds the reusable buttons and range rows used by the shared game menu. */
import {
  type LocalPresentationController,
  MAX_BRIGHTNESS,
  MAX_FONT_SCALE,
  MIN_BRIGHTNESS,
  MIN_FONT_SCALE,
} from "./localPresentation.js";
import { createCarnageControls } from "./carnageControls.js";

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
  label: string,
  minimum: number,
  maximum: number,
  value: number,
  change: (value: number) => void,
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
  const update = () => {
    const next = Number(input.value) / 100;
    output.value = `${Math.round(next * 100)}%`;
    change(next);
  };
  input.addEventListener("input", update);
  output.value = `${Math.round(value * 100)}%`;
  row.append(text, output, input);
  return row;
};

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
  for (const [value, label] of [
    ["system", "Follow device"],
    ["reduce", "Reduce"],
    ["full", "Full"],
  ] as const) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    motionSelect.append(option);
  }
  motionSelect.value = currentMotion;
  motionSelect.addEventListener("change", () => {
    presentation.setMotion(
      motionSelect.value === "reduce" || motionSelect.value === "full"
        ? motionSelect.value
        : "system",
    );
  });
  motion.append(motionText, motionSelect);
  return motion;
};

export const createGraphicsControls = (
  presentation: LocalPresentationController,
): HTMLElement[] => {
  const localTitle = document.createElement("h3");
  localTitle.textContent = "Accessibility";
  localTitle.style.cssText = "margin:8px 0 0;color:#aaaec8;font-size:12px";
  const current = presentation.current();
  const brightness = createSessionRange(
    "World brightness",
    MIN_BRIGHTNESS,
    MAX_BRIGHTNESS,
    current.brightness,
    (value) => presentation.setBrightness(value),
  );
  const font = createSessionRange(
    "HUD font scale",
    MIN_FONT_SCALE,
    MAX_FONT_SCALE,
    current.fontScale,
    (value) => presentation.setFontScale(value),
  );
  const motion = createMotionControl(presentation, current.motion);
  return [
    localTitle,
    brightness,
    font,
    motion,
    ...createCarnageControls(),
  ];
};
