/** Owns shared HTML HUD keyboard shortcuts without coupling the window facade to DOM events. */
export interface ThreeHudKeyboardActions {
  toggleInventory(): void;
  selectHotbar(index: number): void;
  focusChat(): void;
  leaveChat(): void;
  chatOwnsFocus(): boolean;
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
    if (event.code === "Tab") {
      event.preventDefault();
      if (!this.actions.chatOwnsFocus()) this.actions.toggleInventory();
      return;
    }
    if (event.code.startsWith("Digit")) this.selectHotbar(event);
    if (event.code === "Enter" && !this.actions.chatOwnsFocus()) {
      event.preventDefault();
      this.actions.focusChat();
    }
    if (event.code === "Escape" && this.actions.chatOwnsFocus()) {
      event.preventDefault();
      this.actions.leaveChat();
    }
  };

  private selectHotbar(event: KeyboardEvent): void {
    if (this.actions.chatOwnsFocus()) return;
    const index = Number(event.code.slice(5)) - 1;
    if (index < 0 || index >= 9) return;
    event.preventDefault();
    this.actions.selectHotbar(index);
  }
}
