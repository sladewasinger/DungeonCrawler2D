/**
 * DOM chat-input overlay (the "styled DOM overlay" pattern connectForm.ts proved —
 * Phaser has no native text input). Hidden until opened by [Enter] or a DM-button
 * prefill; Enter submits through the owner's callback, Esc closes without sending.
 * The game's key handlers already ignore keys while any input has focus (guarded()).
 */
const PANEL_BG = "#1a1a24";
const PANEL_BORDER = "#494956";

function applyStyle(el: HTMLInputElement): void {
  Object.assign(el.style, {
    position: "fixed",
    display: "none",
    width: "300px",
    padding: "6px 8px",
    background: PANEL_BG,
    color: "#e8e8e8",
    border: `1px solid ${PANEL_BORDER}`,
    fontFamily: "monogram, monospace",
    fontSize: "16px",
    zIndex: "30",
  });
}

export interface ChatInputHandlers {
  onSubmit(text: string): void;
  /** Fires on real focus/blur. The scene uses it to suspend Phaser's global key
   * capture while typing — otherwise every bound hotkey letter (w/a/s/d/e/r/…)
   * is preventDefault'd at the window level and never reaches this input. */
  onFocusChange?(focused: boolean): void;
}

export class ChatInputBox {
  private readonly input: HTMLInputElement;

  constructor(handlers: ChatInputHandlers) {
    this.input = document.createElement("input");
    this.input.maxLength = 200;
    applyStyle(this.input);
    this.input.addEventListener("focus", () => handlers.onFocusChange?.(true));
    this.input.addEventListener("blur", () => handlers.onFocusChange?.(false));
    this.input.addEventListener("keydown", (event) => {
      // Both keys fully belong to the input while it's open — the game must not also act.
      if (event.key === "Enter") {
        event.stopPropagation();
        const text = this.input.value;
        this.close();
        handlers.onSubmit(text);
      } else if (event.key === "Escape") {
        event.stopPropagation();
        this.close();
      }
    });
    document.body.append(this.input);
  }

  /** Opens at a screen position (px, page coords), optionally prefilled ("/dm Wren "). */
  open(left: number, top: number, prefill = ""): void {
    this.input.style.left = `${Math.round(left)}px`;
    this.input.style.top = `${Math.round(top)}px`;
    this.input.style.display = "block";
    this.input.value = prefill;
    this.input.focus();
    this.input.setSelectionRange(prefill.length, prefill.length);
  }

  close(): void {
    this.input.value = "";
    this.input.style.display = "none";
    this.input.blur();
  }

  isOpen(): boolean {
    return this.input.style.display !== "none";
  }

  dispose(): void {
    this.input.remove();
  }
}
