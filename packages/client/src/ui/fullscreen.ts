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
  return window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
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
  const triggerOnce = (): void => {
    if (manualExit || isFullscreenActive()) return;
    void target.requestFullscreen().catch(() => undefined);
  };
  target.addEventListener("pointerdown", triggerOnce, { once: true, passive: true });
}

export function onFullscreenChange(listener: () => void): void {
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) manualExit = true;
    listener();
  });
}
