// DOM name-entry + connect button overlay for TitleScene — Phaser has no native text
// input, so this uses the same "styled DOM overlay" pattern reference/client/main.ts's
// chat input proved, matching the panel language (dark fill, thin border, gold accent)
// from ui/panel.ts and the monogram font from ui/font.ts.
const PANEL_BG = "#1a1a24";
const PANEL_BORDER = "#494956";
const GOLD = "#ffd23d";
const NAME_STORAGE_KEY = "dc2d-name";

export function loadStoredName(): string {
  return localStorage.getItem(NAME_STORAGE_KEY) ?? `Crawler${Math.floor(100 + Math.random() * 900)}`;
}

function applyRootStyle(el: HTMLDivElement): void {
  Object.assign(el.style, {
    position: "fixed",
    left: "50%",
    bottom: "14%",
    transform: "translateX(-50%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
    zIndex: "20",
  });
}

function applyInputStyle(el: HTMLInputElement): void {
  Object.assign(el.style, {
    width: "220px",
    padding: "8px 10px",
    background: PANEL_BG,
    color: "#e8e8e8",
    border: `1px solid ${PANEL_BORDER}`,
    fontFamily: "monogram, monospace",
    fontSize: "16px",
    textAlign: "center",
  });
}

function applyButtonStyle(el: HTMLButtonElement): void {
  Object.assign(el.style, {
    padding: "10px 22px",
    background: PANEL_BG,
    color: GOLD,
    border: `1px solid ${GOLD}`,
    fontFamily: "monogram, monospace",
    fontSize: "16px",
    cursor: "pointer",
    letterSpacing: "1px",
  });
}

function applyStatusStyle(el: HTMLDivElement): void {
  Object.assign(el.style, {
    color: "#9a9aae",
    fontFamily: "monogram, monospace",
    fontSize: "13px",
    minHeight: "16px",
  });
}

export interface ConnectFormHandlers {
  onConnect(name: string): void;
}

export class ConnectForm {
  private readonly root: HTMLDivElement;
  private readonly input: HTMLInputElement;
  private readonly button: HTMLButtonElement;
  private readonly status: HTMLDivElement;

  constructor(handlers: ConnectFormHandlers) {
    this.root = document.createElement("div");
    applyRootStyle(this.root);

    this.input = document.createElement("input");
    this.input.maxLength = 16;
    this.input.value = loadStoredName();
    applyInputStyle(this.input);

    this.button = document.createElement("button");
    this.button.textContent = "Enter the Dungeon";
    applyButtonStyle(this.button);
    this.button.addEventListener("click", () => this.submit(handlers));
    this.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") this.submit(handlers);
    });

    this.status = document.createElement("div");
    applyStatusStyle(this.status);

    this.root.append(this.input, this.button, this.status);
    document.body.append(this.root);
  }

  private submit(handlers: ConnectFormHandlers): void {
    const name = this.input.value.trim().slice(0, 16) || loadStoredName();
    localStorage.setItem(NAME_STORAGE_KEY, name);
    handlers.onConnect(name);
  }

  setStatus(text: string): void {
    this.status.textContent = text;
  }

  setBusy(busy: boolean): void {
    this.button.disabled = busy;
    this.input.disabled = busy;
  }

  dispose(): void {
    this.root.remove();
  }
}
