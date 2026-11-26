/** Mobile-first auto-fullscreen on initial touch gesture and manual fullscreen toggle. */
import { isCoarsePrimaryDevice, isTouchInputActive } from "../input/inputMode.js";

let manualExit = false;

export function isFullscreenSupported(): boolean {
  return typeof document !== "undefined" && typeof document.documentElement.requestFullscreen === "function";
}

export function isFullscreenActive(): boolean {
  return typeof document !== "undefined" && Boolean(document.fullscreenElement);
}

function isCoarsePointerDevice(): boolean {
  return isCoarsePrimaryDevice();
}

function isStandaloneDisplayMode(): boolean {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(display-mode: standalone)").matches);
}

export function shouldShowFullscreenPrompt(): boolean {
  const touchOrCoarse = isCoarsePointerDevice() || isTouchInputActive();
  return isFullscreenSupported() && touchOrCoarse && !isFullscreenActive() && !isStandaloneDisplayMode();
}

export async function toggleFullscreen(): Promise<void> {
  if (!isFullscreenSupported()) return;
  try {
    if (isFullscreenActive()) {
      manualExit = true;
      await document.exitFullscreen();
    } else {
      manualExit = false;
      await document.documentElement.requestFullscreen();
    }
  } catch {
    // Fullscreen can be declined or unsupported in nested mobile WebViews.
  }
}

export function installMobileAutoFullscreen(target: HTMLElement = document.documentElement): void {
  if (!isFullscreenSupported() || !isCoarsePointerDevice()) return;
  void target.requestFullscreen().catch(() => undefined);
  const cleanup = (): void => {
    window.removeEventListener("touchend", onGesture);
    window.removeEventListener("click", onGesture);
  };
  const onGesture = (): void => {
    if (manualExit || isFullscreenActive()) { cleanup(); return; }
    void target.requestFullscreen().then(cleanup, () => undefined);
  };
  window.addEventListener("touchend", onGesture, { passive: true });
  window.addEventListener("click", onGesture, { passive: true });
}

export function onFullscreenChange(listener: () => void): void {
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) manualExit = true;
    listener();
  });
}

export function onFullscreenStateChange(listener: () => void): () => void {
  const handleFs = (): void => {
    if (!document.fullscreenElement) manualExit = true;
    listener();
  };
  document.addEventListener("fullscreenchange", handleFs);
  document.addEventListener("visibilitychange", listener);
  window.addEventListener("pageshow", listener);
  window.addEventListener("focus", listener);
  return () => {
    document.removeEventListener("fullscreenchange", handleFs);
    document.removeEventListener("visibilitychange", listener);
    window.removeEventListener("pageshow", listener);
    window.removeEventListener("focus", listener);
  };
}
