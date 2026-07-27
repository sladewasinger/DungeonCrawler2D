/** Centralizes the shared HUD's semantic tokens and template-backed controls. */
import { createHudTemplate } from "./hudTemplate.js";

export const HUD_GOLD = "#ffd54c";
export const HUD_TEXT = "#f2f0eb";
export const HUD_MUTED = "#aaaec8";
export const HUD_PANEL = "hud-panel";

export const createHudTitle = (text: string): HTMLDivElement => {
  const title = createHudTemplate<HTMLDivElement>("hud-panel-title-template");
  title.textContent = text;
  return title;
};

export const createHudButton = (
  label: string,
  action: () => void,
): HTMLButtonElement => {
  const button = createHudTemplate<HTMLButtonElement>("hud-button-template");
  button.textContent = label;
  button.addEventListener("click", action);
  return button;
};

export const createHudPanelHeader = (
  title: string,
  close: () => void,
): HTMLDivElement => {
  const header = createHudTemplate<HTMLDivElement>("hud-panel-header-template");
  const label = header.querySelector<HTMLElement>("[data-hud-title]");
  const button = header.querySelector<HTMLButtonElement>("[data-hud-close]");
  if (!label || !button) throw new Error("Malformed HUD panel header template");
  label.textContent = title;
  button.setAttribute("aria-label", `Close ${title}`);
  button.addEventListener("click", close);
  return header;
};
