import type { TutorialInputMode } from "../../../ui/tutorials/model.js";
import { HUD_GOLD } from "../styles/ThreeHudStyles.js";

export const createThreeHudTutorialElement = (mode: TutorialInputMode): HTMLDivElement => {
  const element = document.createElement("div");
  element.hidden = true;
  element.setAttribute("role", "status");
  element.setAttribute("aria-live", "polite");
  element.setAttribute("aria-atomic", "true");
  element.style.cssText = "position:absolute;left:50%;bottom:78px;transform:translate(-50%,0);z-index:1100;" +
    "max-width:min(520px,78vw);padding:2px 8px;text-align:center;background:transparent;border:0;" +
    `color:${HUD_GOLD};font:${mode === "touch" ? 14 : 12}px monospace;pointer-events:none;text-shadow:0 1px 3px rgba(0,0,0,.9)`;
  animateTutorialElement(element);
  return element;
};

const animateTutorialElement = (element: HTMLDivElement): void => {
  if (globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  element.animate?.([
    { transform: "translate(-50%,0)" }, { transform: "translate(-50%,-4px)" }, { transform: "translate(-50%,0)" },
  ], { duration: 2400, iterations: Infinity, easing: "ease-in-out" });
};
