/** Provides one browser-compatible mobile fullscreen request and return-retry path. */
import { isTouchDevice } from "../../input/touchDetect.js";

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
}

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

interface OrientationLock {
  lock?(orientation: "landscape"): Promise<void>;
}

type FullscreenScreen = Screen & { orientation?: OrientationLock };

export interface FullscreenRetry {
  dispose(): void;
}

export function isFullscreenActive(doc: FullscreenDocument = document): boolean {
  return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

export function canEnterFullscreen(target: FullscreenElement = document.documentElement, doc: FullscreenDocument = document): boolean {
  const standard = doc.fullscreenEnabled !== false && typeof target.requestFullscreen === "function";
  return standard || typeof target.webkitRequestFullscreen === "function";
}

export function enterFullscreenLandscape(
  target: FullscreenElement = document.documentElement,
  doc: FullscreenDocument = document,
  deviceScreen: FullscreenScreen = screen,
): Promise<boolean> {
  if (isFullscreenActive(doc)) {
    void lockLandscape(deviceScreen);
    return Promise.resolve(true);
  }
  const request = target.requestFullscreen ?? target.webkitRequestFullscreen;
  if (!request || !canEnterFullscreen(target, doc)) return Promise.resolve(false);
  try {
    return Promise.resolve(request.call(target)).then(
      async () => {
        await lockLandscape(deviceScreen);
        return true;
      },
      () => false,
    );
  } catch {
    return Promise.resolve(false);
  }
}

export function installFullscreenResumeRetry(
  target: HTMLElement,
  doc: FullscreenDocument = document,
  deviceScreen: FullscreenScreen = screen,
  touchDevice: boolean = isTouchDevice(),
): FullscreenRetry {
  if (!touchDevice) return { dispose: () => undefined };
  let retryArmed = false;
  const onGameTap = () => {
    disarm();
    void enterFullscreenLandscape(doc.documentElement, doc, deviceScreen);
  };
  const disarm = () => {
    if (!retryArmed) return;
    retryArmed = false;
    target.removeEventListener("pointerdown", onGameTap, true);
  };
  const arm = () => {
    if (retryArmed || isFullscreenActive(doc)) return;
    retryArmed = true;
    target.addEventListener("pointerdown", onGameTap, { capture: true, once: true });
  };
  const onVisibilityChange = () => {
    if (doc.visibilityState === "visible") arm();
    else disarm();
  };
  doc.addEventListener("visibilitychange", onVisibilityChange);
  return {
    dispose: () => {
      disarm();
      doc.removeEventListener("visibilitychange", onVisibilityChange);
    },
  };
}

async function lockLandscape(deviceScreen: FullscreenScreen): Promise<void> {
  try {
    await deviceScreen.orientation?.lock?.("landscape");
  } catch {
    return;
  }
}
