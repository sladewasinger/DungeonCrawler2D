/** Mobile-first auto-fullscreen on initial touch gesture and manual fullscreen toggle. */

let manualExit = false;

export function isFullscreenSupported(): boolean {
  return typeof document !== "undefined" && typeof document.documentElement.requestFullscreen === "function";
}

export function isFullscreenActive(): boolean {
  return typeof document !== "undefined" && Boolean(document.fullscreenElement);
}

export function isCoarsePointerDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches
    || window.matchMedia("(hover: none)").matches
    || navigator.maxTouchPoints > 0
    || "ontouchstart" in window;
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
