/** Dynamic touch vs desktop input mode tracking for hybrid touchscreen laptops and mobile devices. */

export type ActiveInputMode = "touch" | "desktop";

let currentMode: ActiveInputMode | null = null;

export function isCoarsePrimaryDevice(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.matchMedia?.("(pointer: coarse), (hover: none)")?.matches);
}

export function resolveInitialInputMode(): ActiveInputMode {
  return isCoarsePrimaryDevice() ? "touch" : "desktop";
}

export function setActiveInputMode(mode: ActiveInputMode): void {
  const next: ActiveInputMode = isCoarsePrimaryDevice() ? "touch" : mode;
  currentMode = next;
  if (typeof document !== "undefined") {
    document.documentElement.dataset.inputMode = next;
  }
}

export function activeInputMode(): ActiveInputMode {
  if (currentMode === null) {
    setActiveInputMode(resolveInitialInputMode());
  }
  return currentMode ?? "desktop";
}

export function isTouchInputActive(): boolean {
  if (isCoarsePrimaryDevice()) return true;
  if (typeof document !== "undefined" && document.documentElement.dataset.inputMode === "touch") return true;
  return currentMode === "touch";
}

export function syncInputModeFromPointerDown(pointerType: string, msSinceTouch = Number.POSITIVE_INFINITY): void {
  if (pointerType === "touch") {
    setActiveInputMode("touch");
    return;
  }
  if (pointerType === "mouse" && msSinceTouch > 500) {
    setActiveInputMode("desktop");
  }
}

export function shouldSwitchToDesktopOnMouseMove(opts: {
  readonly dx: number;
  readonly dy: number;
  readonly msSinceTouch: number;
}): boolean {
  return opts.msSinceTouch > 500 && Math.hypot(opts.dx, opts.dy) >= 6;
}
