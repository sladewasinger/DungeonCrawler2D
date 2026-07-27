import { createSessionButton } from "./SessionMenuControls.js";

interface SessionMenuPrimaryOptions {
  readonly container: HTMLElement;
  readonly respawnButton: HTMLButtonElement;
  readonly settingsContent: HTMLElement;
  readonly onResume: () => void;
  readonly onQuit: () => void;
  readonly onAdvanced: () => void;
}

export function buildSessionMenuPrimary(
  options: SessionMenuPrimaryOptions,
): HTMLButtonElement {
  const title = heading("h2", "Game menu", "margin:0 0 4px;color:#ffd54c;font-size:20px");
  const resume = createSessionButton("Resume", options.onResume);
  const quit = createSessionButton("Quit to title", options.onQuit);
  const advanced = createSessionButton(
    "Advanced settings",
    options.onAdvanced,
  );
  const hudTitle = heading("h3", "HUD & view", "margin:8px 0 0;color:#aaaec8;font-size:12px");
  options.container.append(
    title,
    resume,
    options.respawnButton,
    quit,
    advanced,
    hudTitle,
    options.settingsContent,
  );
  return resume;
}

function heading(tag: "h2" | "h3", text: string, style: string): HTMLHeadingElement {
  const element = document.createElement(tag);
  element.textContent = text;
  element.style.cssText = style;
  return element;
}

export const createRespawnButton = (
  request: () => void,
): HTMLButtonElement => createSessionButton("Respawn (die)", request);
