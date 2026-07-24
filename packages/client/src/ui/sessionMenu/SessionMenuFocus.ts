/** Contains focus in the session modal while restoring inert background elements on close. */
interface BackgroundState {
  element: HTMLElement;
  inert: boolean;
  ariaHidden: string | null;
}

export class SessionMenuFocus {
  private readonly backgroundState: BackgroundState[] = [];
  private previousFocus: HTMLElement | undefined;
  private active = false;

  constructor(
    private readonly appRoot: HTMLElement,
    private readonly hudRoot: HTMLElement,
    private readonly overlay: HTMLElement,
    private readonly activeFocusables: () => HTMLElement[],
  ) {
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
    const elements = new Set<HTMLElement>();
    for (const child of this.appRoot.children) {
      if (child instanceof HTMLElement && child !== this.hudRoot) {
        elements.add(child);
      }
    }
    for (const child of this.hudRoot.children) {
      if (child instanceof HTMLElement && child !== this.overlay) {
        elements.add(child);
      }
    }
    for (const element of elements) {
      this.backgroundState.push({
        element,
        inert: element.inert,
        ariaHidden: element.getAttribute("aria-hidden"),
      });
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    }
  }

  private restoreBackground(): void {
    for (const state of this.backgroundState) {
      state.element.inert = state.inert;
      if (state.ariaHidden === null) state.element.removeAttribute("aria-hidden");
      else state.element.setAttribute("aria-hidden", state.ariaHidden);
    }
    this.backgroundState.length = 0;
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
    const currentIndex = focusables.indexOf(document.activeElement as HTMLElement);
    const offset = event.shiftKey ? -1 : 1;
    const nextIndex = currentIndex < 0
      ? (event.shiftKey ? focusables.length - 1 : 0)
      : (currentIndex + offset + focusables.length) % focusables.length;
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
