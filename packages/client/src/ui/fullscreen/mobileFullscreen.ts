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

interface FullscreenRetryOptions {
  target: HTMLElement;
  doc?: FullscreenDocument;
  deviceScreen?: FullscreenScreen;
  touchDevice?: boolean;
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
  if (!canEnterFullscreen(target, doc)) return Promise.resolve(false);
  const request = target.requestFullscreen ?? target.webkitRequestFullscreen;
  if (!request) return Promise.resolve(false);
  return requestFullscreen(target, request, deviceScreen);
}

function requestFullscreen(target: FullscreenElement, request: () => Promise<void> | void, deviceScreen: FullscreenScreen): Promise<boolean> {
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
  { target, doc = document, deviceScreen = screen, touchDevice = isTouchDevice() }: FullscreenRetryOptions,
): FullscreenRetry {
  if (!touchDevice) return { dispose: () => undefined };
  return createFullscreenRetry({ target, doc, deviceScreen });
}

function createFullscreenRetry({ target, doc, deviceScreen }: Required<Pick<FullscreenRetryOptions, "target" | "doc" | "deviceScreen">>): FullscreenRetry {
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
  const onVisibilityChange = () => toggleFullscreenRetry(doc, arm, disarm);
  addVisibilityListener(doc, onVisibilityChange);
  return {
    dispose: () => {
      disarm();
      removeVisibilityListener(doc, onVisibilityChange);
    },
  };
}

function toggleFullscreenRetry(doc: Document, arm: () => void, disarm: () => void): void {
  if (doc.visibilityState === "visible") arm();
  else disarm();
}

function addVisibilityListener(doc: Document, listener: () => void): void {
  doc.addEventListener("visibilitychange", listener);
}

function removeVisibilityListener(doc: Document, listener: () => void): void {
  doc.removeEventListener("visibilitychange", listener);
}

async function lockLandscape(deviceScreen: FullscreenScreen): Promise<void> {
  try {
    await deviceScreen.orientation?.lock?.("landscape");
  } catch {
    return;
  }
}
