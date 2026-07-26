import { isTouchDevice } from "./touchDetect.js";

export type InputModality = "desktop" | "touch";
export type DesktopInputKind = "keyboard" | "mouse";
export type InputModalityListener = (mode: InputModality) => void;

export const MOUSE_AFTER_TOUCH_HYSTERESIS_MS = 650;

export class InputModalityStore {
  private mode: InputModality;
  private lastTouchAt = Number.NEGATIVE_INFINITY;
  private readonly listeners = new Set<InputModalityListener>();

  constructor(initialMode: InputModality) {
    this.mode = initialMode;
  }

  get current(): InputModality {
    return this.mode;
  }

  subscribe(listener: InputModalityListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  noteTouch(nowMs = performance.now()): void {
    this.lastTouchAt = nowMs;
    this.transition("touch");
  }

  noteDesktop(kind: DesktopInputKind, nowMs = performance.now()): void {
    if (
      kind === "mouse" &&
      nowMs - this.lastTouchAt < MOUSE_AFTER_TOUCH_HYSTERESIS_MS
    ) return;
    this.transition("desktop");
  }

  private transition(mode: InputModality): void {
    if (mode === this.mode) return;
    this.mode = mode;
    for (const listener of this.listeners) listener(mode);
  }
}

const eventTime = (event: Event): number =>
  event.timeStamp > 0 ? event.timeStamp : performance.now();

export function bindInputModalityEvents(
  store: InputModalityStore,
  win: Window = window,
): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.isTrusted) store.noteDesktop("keyboard", eventTime(event));
  };
  const onPointerDown = (event: PointerEvent) => {
    if (!event.isTrusted) return;
    if (event.pointerType === "touch") store.noteTouch(eventTime(event));
    else if (event.pointerType === "mouse") {
      store.noteDesktop("mouse", eventTime(event));
    }
  };
  const onMouseMove = (event: MouseEvent) => {
    if (event.isTrusted) store.noteDesktop("mouse", eventTime(event));
  };
  const coarse = win.matchMedia?.("(pointer: coarse)");
  const fine = win.matchMedia?.("(pointer: fine)");
  const reevaluatePointer = () => {
    if (coarse?.matches && !fine?.matches) store.noteTouch();
    else if (fine?.matches && !coarse?.matches) store.noteDesktop("mouse");
  };

  win.addEventListener("keydown", onKeyDown, true);
  win.addEventListener("pointerdown", onPointerDown, true);
  win.addEventListener("mousemove", onMouseMove, true);
  win.addEventListener("orientationchange", reevaluatePointer);
  coarse?.addEventListener("change", reevaluatePointer);
  fine?.addEventListener("change", reevaluatePointer);

  return () => {
    win.removeEventListener("keydown", onKeyDown, true);
    win.removeEventListener("pointerdown", onPointerDown, true);
    win.removeEventListener("mousemove", onMouseMove, true);
    win.removeEventListener("orientationchange", reevaluatePointer);
    coarse?.removeEventListener("change", reevaluatePointer);
    fine?.removeEventListener("change", reevaluatePointer);
  };
}

/**
 * `?touch=1` deliberately supplies only the initial mode. A later trusted
 * keyboard or mouse interaction can still return the session to desktop.
 */
export function initialInputModality(win: Window = window): InputModality {
  return isTouchDevice(win) ? "touch" : "desktop";
}

export const inputModality = new InputModalityStore(
  typeof window === "undefined" ? "desktop" : initialInputModality(window),
);

if (typeof window !== "undefined") bindInputModalityEvents(inputModality, window);
