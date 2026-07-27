/** Centralizes DOM mounting, settings, and keyboard composition for the shared HTML HUD. */
import type { HudWindowManager } from "../window/layout/HudWindows.js";
import type { HudKeyboardActions } from "../model/HudKeyboard.js";
import { HudKeyboard } from "../model/HudKeyboard.js";
import { HudSettings } from "../panels/HudSettings.js";
import type { ViewDistance } from "../../../three/terrain/view/viewDistance.js";

export interface HudSetupOptions {
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
  const reticle = document.createElement("div");
  reticle.style.cssText =
    "position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px;" +
    "border:1px solid rgba(255,255,255,.82);box-sizing:border-box;pointer-events:none";
  root.append(reticle);
};

export const createHudSettings = (
  manager: HudWindowManager,
  options: HudSetupOptions,
): HudSettings => {
  let activeDistance: ViewDistance = options.viewDistance ?? 18;
  return new HudSettings(
    manager,
    options.viewDistance === undefined ? undefined : () => activeDistance,
    options.setViewDistance === undefined
      ? undefined
      : (distance) => {
        activeDistance = distance;
        options.setViewDistance?.(distance);
      },
  );
};

export const createHudKeyboard = (
  actions: HudKeyboardActions,
  options: HudSetupOptions,
): HudKeyboard =>
  new HudKeyboard(actions, options.bindKeyboard !== false);
