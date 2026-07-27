import { isTouchDevice } from "./touchDetect.js";

export type InputModality = "desktop" | "touch";
export type DesktopInputKind = "keyboard" | "mouse";
export type InputModalityListener = (mode: InputModality) => void;

export const MOUSE_AFTER_TOUCH_HYSTERESIS_MS = 650;
export const MOUSE_DEMOTION_CONFIRM_MS = 80;
const MOUSE_DEMOTION_WINDOW_MS = 1_000;

export class InputModalityStore {
  private mode: InputModality;
  private lastTouchAt = Number.NEGATIVE_INFINITY;
  private mouseCandidateAt: number | null = null;
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
    this.mouseCandidateAt = null;
    this.transition("touch");
  }

  noteDesktop(kind: DesktopInputKind, nowMs = performance.now()): void {
    if (this.shouldDeferMouseDemotion(kind, nowMs)) return;
    this.mouseCandidateAt = null;
    this.transition("desktop");
  }

  private shouldDeferMouseDemotion(kind: DesktopInputKind, nowMs: number): boolean {
    if (kind !== "mouse" || this.mode !== "touch") return false;
    if (nowMs - this.lastTouchAt < MOUSE_AFTER_TOUCH_HYSTERESIS_MS) return true;
    return this.needsMouseConfirmation(nowMs);
  }

  private needsMouseConfirmation(nowMs: number): boolean {
    const candidateAt = this.mouseCandidateAt;
    if (candidateAt === null || nowMs - candidateAt > MOUSE_DEMOTION_WINDOW_MS) {
      this.mouseCandidateAt = nowMs;
      return true;
    }
    return nowMs - candidateAt < MOUSE_DEMOTION_CONFIRM_MS;
  }

  private transition(mode: InputModality): void {
    if (mode === this.mode) return;
    this.mode = mode;
    for (const listener of this.listeners) listener(mode);
  }
}

const eventTime = (event: Event): number =>
  event.timeStamp > 0 ? event.timeStamp : performance.now();

interface InputModalityEventHandlers {
  onKeyDown(event: KeyboardEvent): void;
  onPointerDown(event: PointerEvent): void;
  onMouseMove(event: MouseEvent): void;
}

function createInputEventHandlers(store: InputModalityStore): InputModalityEventHandlers {
  return {
    onKeyDown: (event) => noteTrustedKeyboard(store, event),
    onPointerDown: (event) => noteTrustedPointer(store, event),
    onMouseMove: (event) => noteTrustedMouse(store, event),
  };
}

function noteTrustedKeyboard(store: InputModalityStore, event: KeyboardEvent): void {
  if (event.isTrusted) store.noteDesktop("keyboard", eventTime(event));
}

function noteTrustedPointer(store: InputModalityStore, event: PointerEvent): void {
  if (!event.isTrusted) return;
  if (event.pointerType === "touch") store.noteTouch(eventTime(event));
  if (event.pointerType === "mouse") store.noteDesktop("mouse", eventTime(event));
}

function noteTrustedMouse(store: InputModalityStore, event: MouseEvent): void {
  if (event.isTrusted) store.noteDesktop("mouse", eventTime(event));
}

function reevaluatePointerModality(store: InputModalityStore, coarse: MediaQueryList | undefined, fine: MediaQueryList | undefined): void {
  const pointerMode = preferredPointerMode(coarse, fine);
  if (pointerMode === "touch") store.noteTouch();
  if (pointerMode === "desktop") store.noteDesktop("mouse");
}

function preferredPointerMode(coarse: MediaQueryList | undefined, fine: MediaQueryList | undefined): InputModality | null {
  if (isTouchOnlyPointer(coarse, fine)) return "touch";
  if (isFineOnlyPointer(coarse, fine)) return "desktop";
  return null;
}

function isTouchOnlyPointer(coarse: MediaQueryList | undefined, fine: MediaQueryList | undefined): boolean {
  return coarse?.matches === true && fine?.matches !== true;
}

function isFineOnlyPointer(coarse: MediaQueryList | undefined, fine: MediaQueryList | undefined): boolean {
  return fine?.matches === true && coarse?.matches !== true;
}

export function bindInputModalityEvents(
  store: InputModalityStore,
  win: Window = window,
): () => void {
  const { onKeyDown, onPointerDown, onMouseMove } = createInputEventHandlers(store);
  const coarse = win.matchMedia?.("(pointer: coarse)");
  const fine = win.matchMedia?.("(pointer: fine)");
  const reevaluatePointer = () => reevaluatePointerModality(store, coarse, fine);

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
