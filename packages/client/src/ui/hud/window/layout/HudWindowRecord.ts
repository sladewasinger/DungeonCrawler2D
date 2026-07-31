/** Builds the stable DOM shell and mutable record for one HUD window. */
import type { HudWindowLayout } from "./hudWindowStorage.js";
import type { HudWindowSpec } from "./HudWindows.js";
import { createHudTemplate, requireHudElement } from "../../styles/hudTemplate.js";

export const HUD_CONTENT_ONLY_WINDOW_CLASS = "hud-window--content-only";
export const HUD_INTRINSIC_HEIGHT_WINDOW_CLASS = "hud-window--intrinsic-height";

export interface HudWindowRecord {
  id: string;
  title: string;
  element: HTMLDivElement;
  content: HTMLDivElement;
  layout: HudWindowLayout;
  interactive: boolean;
  aspectRatio?: number;
  minWidth?: number;
  minHeight?: number;
}

export const buildHudWindow = (spec: HudWindowSpec) => {
  const element = createHudTemplate<HTMLDivElement>("hud-window-template");
  element.dataset.hudWindow = spec.id;
  element.setAttribute("aria-label", spec.title);
  if (spec.chrome === "content-only") {
    element.classList.add(HUD_CONTENT_ONLY_WINDOW_CLASS);
  }
  if (spec.intrinsicMinHeight) {
    element.classList.add(HUD_INTRINSIC_HEIGHT_WINDOW_CLASS);
  }
  const content = requireHudElement<HTMLDivElement>(element, "[data-hud-window-content]");
  content.append(spec.content);
  return { element, content };
};
