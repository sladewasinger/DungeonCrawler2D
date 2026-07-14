export interface GameMenuActions {
  onOpenChange(open: boolean): void;
  onSuicide(): void;
  onExit(): void;
}

export class GameMenu {
  private readonly button = document.createElement("button");
  private readonly overlay = document.createElement("div");
  private readonly suicideButton = document.createElement("button");
  private open = false;
  private confirmSuicide = false;
  private available = false;

  constructor(private readonly actions: GameMenuActions) {
    this.button.type = "button";
    this.button.textContent = "MENU [Esc]";
    Object.assign(this.button.style, { position: "fixed", top: "12px", right: "12px", zIndex: "30", display: "none", padding: "8px 12px", border: "1px solid #9fe8c9", background: "#0d0a12d9", color: "#9fe8c9", font: "13px monospace", cursor: "pointer" });
    this.button.addEventListener("click", () => this.toggle());
    Object.assign(this.overlay.style, { position: "fixed", inset: "0", zIndex: "40", display: "none", placeItems: "center", background: "#07060bb8", color: "#e8e4f0", fontFamily: "monospace" });
    const panel = document.createElement("section");
    Object.assign(panel.style, { width: "min(380px, calc(100vw - 40px))", display: "grid", gap: "12px", padding: "28px", border: "1px solid #9fe8c9", background: "#0d0a12f2", boxShadow: "0 20px 70px #000c" });
    const title = document.createElement("h2");
    title.textContent = "GAME MENU";
    Object.assign(title.style, { margin: "0 0 6px", color: "#ffe9b0", letterSpacing: "2px" });
    const resume = this.actionButton("Resume", () => this.close());
    this.styleAction(this.suicideButton);
    this.suicideButton.textContent = "Kill Crawler";
    this.suicideButton.addEventListener("click", () => {
      if (!this.confirmSuicide) {
        this.confirmSuicide = true;
        this.suicideButton.textContent = "Confirm: drop loot and die";
        return;
      }
      this.actions.onSuicide();
      this.close();
    });
    const exit = this.actionButton("Exit to Mode Select", () => {
      this.close();
      this.actions.onExit();
    });
    panel.append(title, resume, this.suicideButton, exit);
    this.overlay.append(panel);
    document.body.append(this.button, this.overlay);
    window.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !this.available) return;
      if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      this.toggle();
    });
  }

  showButton(): void {
    this.available = true;
    this.button.style.display = "block";
  }

  hide(): void {
    this.available = false;
    this.button.style.display = "none";
    if (this.open) this.close();
  }

  setCanSuicide(canSuicide: boolean): void {
    this.suicideButton.disabled = !canSuicide;
    if (!canSuicide) {
      this.confirmSuicide = false;
      this.suicideButton.textContent = "Kill Crawler (unavailable)";
    } else if (!this.confirmSuicide) this.suicideButton.textContent = "Kill Crawler";
  }

  private toggle(): void {
    if (this.open) this.close();
    else {
      this.open = true;
      this.confirmSuicide = false;
      this.overlay.style.display = "grid";
      this.actions.onOpenChange(true);
    }
  }

  private close(): void {
    this.open = false;
    this.confirmSuicide = false;
    this.overlay.style.display = "none";
    this.suicideButton.textContent = this.suicideButton.disabled ? "Kill Crawler (unavailable)" : "Kill Crawler";
    this.actions.onOpenChange(false);
  }

  private actionButton(label: string, action: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    this.styleAction(button);
    button.addEventListener("click", action);
    return button;
  }

  private styleAction(button: HTMLButtonElement): void {
    Object.assign(button.style, { padding: "12px 14px", border: "1px solid #5c5470", background: "#171421", color: "#e8e4f0", font: "inherit", cursor: "pointer", textAlign: "left" });
  }
}
