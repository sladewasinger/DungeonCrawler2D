// DOM name-entry + connect button overlay for TitleScene — Phaser has no native text
// input, so this uses the same "styled DOM overlay" pattern reference/client/main.ts's
// chat input proved, matching the panel language (dark fill, thin border, gold accent)
// from ui/panel.ts and the monogram font from ui/font.ts.
import { LEVEL, type LevelId, type PlayerSkin } from "@dc2d/engine";
import { APP_VERSION } from "../../appVersion.js";
import { RELEASE_NOTES_INDEX_PATH } from "../../releaseNotesUrl.js";
import { CharacterSelection } from "./characterSelection.js";

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
    bottom: "3%",
    transform: "translateX(-50%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    zIndex: "20",
  });
}

function applyInputStyle(el: HTMLInputElement): void {
  Object.assign(el.style, {
    width: "220px",
    padding: "10px 12px",
    background: PANEL_BG,
    color: "#e8e8e8",
    border: `1px solid ${PANEL_BORDER}`,
    fontFamily: "monogram, monospace",
    fontSize: "20px",
    textAlign: "center",
  });
}

function applyButtonStyle(el: HTMLButtonElement): void {
  Object.assign(el.style, {
    padding: "12px 26px",
    background: PANEL_BG,
    color: GOLD,
    border: `1px solid ${GOLD}`,
    fontFamily: "monogram, monospace",
    fontSize: "20px",
    cursor: "pointer",
    letterSpacing: "1px",
    display: "grid",
    gap: "4px",
    textAlign: "left",
  });
}

function applyStatusStyle(el: HTMLDivElement): void {
  Object.assign(el.style, {
    color: "#9a9aae",
    fontFamily: "monogram, monospace",
    fontSize: "16px",
    minHeight: "16px",
  });
}

function createStatus(): HTMLDivElement {
  const status = document.createElement("div");
  applyStatusStyle(status);
  return status;
}

function createReleaseNotesLink(): HTMLAnchorElement {
  const releaseNotes = document.createElement("a");
  releaseNotes.href = RELEASE_NOTES_INDEX_PATH;
  releaseNotes.textContent = `Release Notes · v${APP_VERSION}`;
  releaseNotes.style.cssText =
    "color:#c4c4d0;font:16px monogram,monospace;text-underline-offset:3px;pointer-events:auto";
  releaseNotes.setAttribute("aria-label", `Read release notes for version ${APP_VERSION}`);
  return releaseNotes;
}

export interface ConnectFormHandlers {
  onConnect(name: string, level: LevelId, skin: PlayerSkin): void;
}

export class ConnectForm {
  private readonly root: HTMLDivElement;
  private readonly input: HTMLInputElement;
  private readonly buttons: HTMLButtonElement[] = [];
  private readonly status: HTMLDivElement;
  private readonly character = new CharacterSelection();

  constructor(handlers: ConnectFormHandlers) {
    this.root = document.createElement("div");
    applyRootStyle(this.root);

    this.input = document.createElement("input");
    this.input.maxLength = 16;
    this.input.value = loadStoredName();
    applyInputStyle(this.input);

    const choices = this.createChoices(handlers);
    this.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") this.submit(handlers, LEVEL.Dungeon);
    });

    this.status = createStatus();
    this.root.append(
      this.character.element,
      this.input,
      choices,
      this.status,
      createReleaseNotesLink(),
    );
    document.body.append(this.root);
  }

  private createChoices(handlers: ConnectFormHandlers): HTMLDivElement {
    const choices = document.createElement("div");
    choices.style.cssText = "display:flex;gap:10px;flex-wrap:wrap;justify-content:center";
    this.buttons.push(
      this.createButton(
        "Enter the Dungeon", "Procedural world · enemies · progression", LEVEL.Dungeon, handlers,
      ),
      this.createButton(
        "Enter the Sandbox", "Fixed traversal course · no enemies", LEVEL.Sandbox, handlers,
      ),
    );
    choices.append(...this.buttons);
    return choices;
  }

  private createButton(
    label: string,
    detail: string,
    level: LevelId,
    handlers: ConnectFormHandlers,
  ): HTMLButtonElement {
    const button = document.createElement("button");
    const title = document.createElement("strong");
    title.textContent = label;
    const description = document.createElement("small");
    description.textContent = detail;
    description.style.cssText = "color:#c4c4d0;font-size:14px;letter-spacing:0";
    button.append(title, description);
    button.setAttribute("aria-label", label);
    applyButtonStyle(button);
    button.addEventListener("click", () => this.submit(handlers, level));
    return button;
  }

  private submit(handlers: ConnectFormHandlers, level: LevelId): void {
    const name = this.input.value.trim().slice(0, 16) || loadStoredName();
    localStorage.setItem(NAME_STORAGE_KEY, name);
    handlers.onConnect(name, level, this.character.skin);
  }

  setStatus(text: string): void {
    this.status.textContent = text;
  }

  setBusy(busy: boolean): void {
    for (const button of this.buttons) button.disabled = busy;
    this.input.disabled = busy;
    this.character.setBusy(busy);
  }

  dispose(): void {
    this.root.remove();
  }
}
