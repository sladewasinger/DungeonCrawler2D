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
  const title = document.createElement("h2");
  title.textContent = "Game menu";
  title.style.cssText = "margin:0 0 4px;color:#ffd54c;font-size:20px";
  const resume = createSessionButton("Resume", options.onResume);
  const quit = createSessionButton("Quit to title", options.onQuit);
  const advanced = createSessionButton(
    "Advanced settings",
    options.onAdvanced,
  );
  const hudTitle = document.createElement("h3");
  hudTitle.textContent = "HUD & view";
  hudTitle.style.cssText = "margin:8px 0 0;color:#aaaec8;font-size:12px";
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

export const createRespawnButton = (
  request: () => void,
): HTMLButtonElement => createSessionButton("Respawn (die)", request);
