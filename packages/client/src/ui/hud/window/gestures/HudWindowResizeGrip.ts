/** Builds the touch-sized visual resize affordance shown during HUD edit mode. */
import { createHudTemplate } from "../../styles/hudTemplate.js";

export const createHudWindowResizeGrip = (): HTMLDivElement => {
  return createHudTemplate<HTMLDivElement>("hud-window-resize-grip-template");
};

export const isHudWindowResizeGrip = (
  target: EventTarget | null,
  grip: HTMLDivElement,
): boolean => target === grip ||
  (target instanceof Element &&
    target.closest("[data-hud-resize-grip='true']") === grip);
