/** Centralizes DOM mounting, settings, and keyboard composition for the shared HTML HUD. */
import type { HudWindowManager } from "../window/layout/HudWindows.js";
import type { HudKeyboardActions } from "../model/HudKeyboard.js";
import { HudKeyboard } from "../model/HudKeyboard.js";
import { HudSettings } from "../panels/HudSettings.js";
import type { ViewDistance } from "../../../three/terrain/view/viewDistance.js";
import { createHudTemplate } from "../styles/hudTemplate.js";
import type { Connection } from "../../../net/connection/connection.js";

export interface HudSetupOptions {
  connection?: Connection | undefined;
  viewDistance?: ViewDistance | undefined;
  setViewDistance?: ((viewDistance: ViewDistance) => void) | undefined;
  bindKeyboard?: boolean;
}

export const mountHudRoot = (
  root: HTMLElement,
  element: HTMLElement,
): void => {
  root.style.position = "relative";
  root.append(element);
};

export const mountHudOverlays = (
  root: HTMLElement,
  overlays: readonly HTMLElement[],
): void => {
  root.append(...overlays);
};

export const mountHudReticle = (root: HTMLElement): void => {
  root.append(createHudTemplate("hud-reticle-template"));
};

export const createHudSettings = (
  manager: HudWindowManager,
  options: HudSetupOptions,
): HudSettings => {
  let activeDistance: ViewDistance = options.viewDistance ?? 18;
  return new HudSettings({
    manager,
    getViewDistance: options.viewDistance === undefined
      ? undefined
      : () => activeDistance,
    setViewDistance: options.setViewDistance === undefined
      ? undefined
      : (distance) => {
        activeDistance = distance;
        options.setViewDistance?.(distance);
      },
    connection: options.connection,
  });
};

export const createHudKeyboard = (
  actions: HudKeyboardActions,
  options: HudSetupOptions,
): HudKeyboard =>
  new HudKeyboard(actions, options.bindKeyboard !== false);
