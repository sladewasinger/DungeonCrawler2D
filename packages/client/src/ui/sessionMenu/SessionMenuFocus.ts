/** Contains focus in the session modal while restoring inert background elements on close. */
interface BackgroundState {
  element: HTMLElement;
  inert: boolean;
  ariaHidden: string | null;
}

interface SessionMenuFocusOptions {
  appRoot: HTMLElement;
  hudRoot: HTMLElement;
  overlay: HTMLElement;
  activeFocusables: () => HTMLElement[];
}

const ARIA_HIDDEN = "aria-hidden";

export class SessionMenuFocus {
  private readonly appRoot: HTMLElement;
  private readonly hudRoot: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly activeFocusables: () => HTMLElement[];
  private readonly backgroundState: BackgroundState[] = [];
  private previousFocus: HTMLElement | undefined;
  private active = false;

  constructor({ appRoot, hudRoot, overlay, activeFocusables }: SessionMenuFocusOptions) {
    this.appRoot = appRoot;
    this.hudRoot = hudRoot;
    this.overlay = overlay;
    this.activeFocusables = activeFocusables;
    document.addEventListener("focusin", this.containFocus, true);
    overlay.addEventListener("keydown", this.trapKeyboardFocus);
  }

  remember(): void {
    this.previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined;
  }

  activate(initialFocus: HTMLElement | undefined): void {
    this.active = true;
    this.disableBackground();
    requestAnimationFrame(() => {
      if (this.active) initialFocus?.focus({ preventScroll: true });
    });
  }

  deactivate(restoreFocus: boolean, fallback: () => void): void {
    this.active = false;
    this.restoreBackground();
    const previousFocus = this.previousFocus;
    this.previousFocus = undefined;
    if (!restoreFocus) return;
    if (previousFocus?.isConnected && !previousFocus.inert) {
      previousFocus.focus({ preventScroll: true });
      if (document.activeElement === previousFocus) return;
    }
    fallback();
  }

  dispose(): void {
    this.active = false;
    this.restoreBackground();
    document.removeEventListener("focusin", this.containFocus, true);
    this.overlay.removeEventListener("keydown", this.trapKeyboardFocus);
  }

  private disableBackground(): void {
    this.restoreBackground();
    for (const element of this.backgroundElements()) {
      this.backgroundState.push({
        element,
        inert: element.inert,
        ariaHidden: element.getAttribute(ARIA_HIDDEN),
      });
      element.inert = true;
      element.setAttribute(ARIA_HIDDEN, "true");
    }
  }

  private restoreBackground(): void {
    for (const state of this.backgroundState) {
      state.element.inert = state.inert;
      if (state.ariaHidden === null) state.element.removeAttribute(ARIA_HIDDEN);
      else state.element.setAttribute(ARIA_HIDDEN, state.ariaHidden);
    }
    this.backgroundState.length = 0;
  }

  private backgroundElements(): Set<HTMLElement> {
    return new Set([
      ...this.backgroundChildren(this.appRoot, this.hudRoot),
      ...this.backgroundChildren(this.hudRoot, this.overlay),
    ]);
  }

  private backgroundChildren(root: HTMLElement, excluded: HTMLElement): HTMLElement[] {
    return [...root.children].filter((child): child is HTMLElement => child instanceof HTMLElement && child !== excluded);
  }

  private readonly containFocus = (event: FocusEvent): void => {
    if (!this.active || this.overlay.contains(event.target as Node)) return;
    this.activeFocusables()[0]?.focus({ preventScroll: true });
  };

  private readonly trapKeyboardFocus = (event: KeyboardEvent): void => {
    if (!this.active) return;
    if (this.activateButton(event)) return;
    if (event.code !== "Tab") return;
    const focusables = this.activeFocusables();
    if (focusables.length === 0) {
      event.preventDefault();
      return;
    }
    const nextIndex = nextFocusableIndex(focusables, event.shiftKey);
    event.preventDefault();
    focusables[nextIndex]?.focus({ preventScroll: true });
  };

  private activateButton(event: KeyboardEvent): boolean {
    if (event.code !== "Enter" && event.code !== "Space") return false;
    if (!(event.target instanceof HTMLButtonElement)) return false;
    event.preventDefault();
    event.stopPropagation();
    event.target.click();
    return true;
  }
}

function nextFocusableIndex(focusables: HTMLElement[], reverse: boolean): number {
  const currentIndex = focusables.indexOf(document.activeElement as HTMLElement);
  if (currentIndex < 0) return reverse ? focusables.length - 1 : 0;
  return (currentIndex + (reverse ? -1 : 1) + focusables.length) % focusables.length;
}
