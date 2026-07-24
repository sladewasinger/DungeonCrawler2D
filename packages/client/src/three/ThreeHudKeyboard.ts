/** Owns shared HTML HUD keyboard shortcuts without coupling the window facade to DOM events. */
export interface ThreeHudKeyboardActions {
  toggleInventory(): void;
  closeInventory(): void;
  inventoryOpen(): boolean;
  selectHotbar(index: number): void;
  focusChat(): void;
  leaveChat(): void;
  chatOwnsFocus(): boolean;
  closeOverlays(): boolean;
  sessionMenuOpen(): boolean;
  toggleSessionMenu(): void;
  closeSessionMenu(): void;
}

export class ThreeHudKeyboard {
  constructor(
    private readonly actions: ThreeHudKeyboardActions,
    enabled: boolean,
  ) {
    if (enabled) window.addEventListener("keydown", this.onKeyDown, true);
    this.enabled = enabled;
  }

  private readonly enabled: boolean;

  dispose(): void {
    if (this.enabled) {
      window.removeEventListener("keydown", this.onKeyDown, true);
    }
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;
    if (this.captureSessionMenuEvent(event)) return;
    if (this.captureTabEvent(event)) return;
    if (this.captureInventoryToggleEvent(event)) return;
    if (this.captureInventoryEvent(event)) return;
    if (event.code.startsWith("Digit")) this.selectHotbar(event);
    if (event.code === "Enter" && !this.actions.chatOwnsFocus()) {
      event.preventDefault();
      this.actions.focusChat();
    }
    this.captureEscapeEvent(event);
  };

  private captureSessionMenuEvent(event: KeyboardEvent): boolean {
    if (!this.actions.sessionMenuOpen()) return false;
    if (event.code === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.actions.closeSessionMenu();
    }
    return true;
  }

  private captureTabEvent(event: KeyboardEvent): boolean {
    if (event.code !== "Tab") return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!this.actions.chatOwnsFocus()) this.actions.toggleInventory();
    return true;
  }

  private captureInventoryToggleEvent(event: KeyboardEvent): boolean {
    if (event.code !== "KeyI" || this.actions.chatOwnsFocus()) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.actions.toggleInventory();
    return true;
  }

  private selectHotbar(event: KeyboardEvent): void {
    if (this.actions.chatOwnsFocus()) return;
    const index = Number(event.code.slice(5)) - 1;
    if (index < 0 || index >= 9) return;
    event.preventDefault();
    this.actions.selectHotbar(index);
  }

  private captureInventoryEvent(event: KeyboardEvent): boolean {
    if (!this.actions.inventoryOpen()) return false;
    if (event.code === "Escape") {
      event.preventDefault();
      this.actions.closeInventory();
    } else if (!(event.target instanceof Element) ||
      !event.target.closest("[data-inventory-workspace]")) {
      event.preventDefault();
    }
    return true;
  }

  private captureEscapeEvent(event: KeyboardEvent): boolean {
    if (event.code !== "Escape") return false;
    if (this.actions.chatOwnsFocus()) {
      this.actions.leaveChat();
    } else if (this.actions.closeOverlays()) {
      // Transient windows close before Escape opens the game menu.
    } else if (this.actions.sessionMenuOpen()) {
      this.actions.closeSessionMenu();
    } else {
      this.actions.toggleSessionMenu();
    }
    event.preventDefault();
    return true;
  }
}
