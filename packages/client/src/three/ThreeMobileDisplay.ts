import { isTouchDevice } from "../input/touchDetect.js";
import { canEnterFullscreen, enterFullscreenLandscape, installFullscreenResumeRetry, isFullscreenActive } from "../ui/fullscreen/mobileFullscreen.js";

export const enableMobileDisplay = (root: HTMLElement): (() => void) => {
  if (!isTouchDevice()) return () => undefined;
  const retry = installFullscreenResumeRetry({ target: root });
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "FULL";
  button.setAttribute("aria-label", "Enter fullscreen landscape mode");
  button.style.cssText = "position:absolute;right:56px;top:12px;z-index:1000;height:34px;padding:0 8px;border:1px solid #71758b;background:rgba(18,19,30,.76);color:#f3f0e9;font:11px monospace;pointer-events:auto";
  const enter = () => { void enterFullscreenLandscape(); };
  const sync = () => { button.hidden = isFullscreenActive() || !canEnterFullscreen(); };
  button.addEventListener("click", enter);
  root.append(button);
  document.addEventListener("fullscreenchange", sync);
  document.addEventListener("webkitfullscreenchange", sync);
  sync();
  return () => {
    retry.dispose();
    document.removeEventListener("fullscreenchange", sync);
    document.removeEventListener("webkitfullscreenchange", sync);
    button.remove();
  };
};
