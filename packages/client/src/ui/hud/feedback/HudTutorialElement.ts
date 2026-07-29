import type { TutorialInputMode } from "../../../ui/tutorials/model.js";
import { createHudTemplate } from "../styles/hudTemplate.js";

export const createHudTutorialElement = (mode: TutorialInputMode): HTMLDivElement => {
  const element = createHudTemplate<HTMLDivElement>("hud-tutorial-template");
  element.hidden = true;
  element.dataset.inputMode = mode;
  animateTutorialElement(element);
  return element;
};

const animateTutorialElement = (element: HTMLDivElement): void => {
  if (globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  element.animate?.([
    { transform: "translate(-50%,0)" }, { transform: "translate(-50%,-4px)" }, { transform: "translate(-50%,0)" },
  ], { duration: 2400, iterations: Infinity, easing: "ease-in-out" });
};
