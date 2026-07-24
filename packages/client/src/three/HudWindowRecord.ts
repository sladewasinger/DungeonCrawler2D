/** Builds the stable DOM shell and mutable record for one HUD window. */
import type { HudWindowLayout } from "./hudWindowStorage.js";
import type { HudWindowSpec } from "./HudWindows.js";

export interface HudWindowRecord {
  id: string;
  title: string;
  element: HTMLDivElement;
  content: HTMLDivElement;
  layout: HudWindowLayout;
  interactive: boolean;
}

export const buildHudWindow = (spec: HudWindowSpec) => {
  const element = document.createElement("div");
  element.dataset.hudWindow = spec.id;
  element.setAttribute("aria-label", spec.title);
  element.style.cssText =
    "position:absolute;min-width:0;min-height:0;overflow:hidden;" +
    "color:#f2f0eb;font:12px monospace;box-sizing:border-box";
  const content = document.createElement("div");
  content.style.cssText =
    "width:100%;height:100%;min-width:0;min-height:0;" +
    "overflow:hidden;box-sizing:border-box";
  content.append(spec.content);
  element.append(content);
  return { element, content };
};
