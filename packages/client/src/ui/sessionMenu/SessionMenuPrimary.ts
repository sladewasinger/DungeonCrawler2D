import { createSessionButton } from "./SessionMenuControls.js";
import { createHudTemplate } from "../hud/styles/hudTemplate.js";

interface SessionMenuPrimaryOptions {
  readonly container: HTMLElement;
  readonly respawnButton: HTMLButtonElement;
  readonly settingsContent: HTMLElement;
  readonly onResume: () => void;
  readonly onRescue: () => void;
  readonly onQuit: () => void;
  readonly onAdvanced: () => void;
}

export function buildSessionMenuPrimary(
  options: SessionMenuPrimaryOptions,
): HTMLButtonElement {
  const title = createHudTemplate<HTMLHeadingElement>("hud-session-heading-template");
  title.textContent = "Game menu";
  const resume = createSessionButton("Resume", options.onResume);
  const rescue = createSessionButton("I'm stuck", options.onRescue);
  const quit = createSessionButton("Quit to title", options.onQuit);
  const advanced = createSessionButton(
    "Advanced settings",
    options.onAdvanced,
  );
  const hudTitle = createHudTemplate<HTMLHeadingElement>("hud-session-subheading-template");
  hudTitle.textContent = "HUD & view";
  options.container.append(
    title,
    resume,
    rescue,
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
