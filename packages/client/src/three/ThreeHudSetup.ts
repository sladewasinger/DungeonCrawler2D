/** Centralizes DOM mounting, settings, and keyboard composition for the shared HTML HUD. */
import type { HudWindowManager } from "./HudWindows.js";
import type { ThreeHudKeyboardActions } from "./ThreeHudKeyboard.js";
import { ThreeHudKeyboard } from "./ThreeHudKeyboard.js";
import { ThreeHudSettings } from "./ThreeHudSettings.js";
import type { ViewDistance } from "./viewDistance.js";

export interface ThreeHudSetupOptions {
  viewDistance?: ViewDistance | undefined;
  setViewDistance?: ((viewDistance: ViewDistance) => void) | undefined;
  bindKeyboard?: boolean;
  replayTutorials?: () => void;
}

export const mountHudRoot = (
  root: HTMLElement,
  element: HTMLElement,
): void => {
  root.style.position = "relative";
  element.style.cssText =
    "position:absolute;inset:0;z-index:2;pointer-events:none;color:#f2f0eb;" +
    "font:12px monospace;text-shadow:0 2px 4px #000";
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
  options: ThreeHudSetupOptions,
): ThreeHudSettings => {
  let activeDistance: ViewDistance = options.viewDistance ?? 18;
  return new ThreeHudSettings(
    manager,
    options.viewDistance === undefined ? undefined : () => activeDistance,
    options.setViewDistance === undefined
      ? undefined
      : (distance) => {
        activeDistance = distance;
        options.setViewDistance?.(distance);
      },
    options.replayTutorials,
  );
};

export const createHudKeyboard = (
  actions: ThreeHudKeyboardActions,
  options: ThreeHudSetupOptions,
): ThreeHudKeyboard =>
  new ThreeHudKeyboard(actions, options.bindKeyboard !== false);
