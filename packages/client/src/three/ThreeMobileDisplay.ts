/** Owns mobile fullscreen and best-effort landscape locking for the Three.js route. */
import { isTouchDevice } from "../input/touchDetect.js";

interface OrientationLock {
  lock?(orientation: string): Promise<void>;
}

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
}

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
}

const requestLandscape = (): void => {
  (screen.orientation as unknown as OrientationLock).lock?.("landscape").catch(() => undefined);
};

export const enableMobileDisplay = (root: HTMLElement): (() => void) => {
  if (!isTouchDevice()) return () => undefined;
  const documentElement = document.documentElement as FullscreenElement;
  const fullscreenDocument = document as FullscreenDocument;
  const isFullscreen = () => document.fullscreenElement !== null || fullscreenDocument.webkitFullscreenElement !== null;
  const enter = () => {
    if (isFullscreen()) {
      requestLandscape();
      return;
    }
    const requestFullscreen = documentElement.requestFullscreen?.bind(documentElement) ?? documentElement.webkitRequestFullscreen?.bind(documentElement);
    if (!requestFullscreen) return;
    void requestFullscreen().then(requestLandscape).catch(() => undefined);
  };
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "FULL";
  button.setAttribute("aria-label", "Enter fullscreen landscape mode");
  button.style.cssText = "position:absolute;right:56px;top:12px;z-index:1000;height:34px;padding:0 8px;border:1px solid #71758b;background:rgba(18,19,30,.76);color:#f3f0e9;font:11px monospace;pointer-events:auto";
  const sync = () => { button.hidden = isFullscreen(); };
  button.addEventListener("click", enter);
  root.append(button);
  root.addEventListener("pointerdown", enter, { capture: true, once: true });
  root.addEventListener("click", enter, { capture: true, once: true });
  document.addEventListener("fullscreenchange", sync);
  document.addEventListener("webkitfullscreenchange", sync);
  sync();
  return () => {
    root.removeEventListener("pointerdown", enter, { capture: true });
    root.removeEventListener("click", enter, { capture: true });
    document.removeEventListener("fullscreenchange", sync);
    document.removeEventListener("webkitfullscreenchange", sync);
    button.remove();
  };
};
