// DOM name-entry + connect button overlay for TitleScene. Phaser has no native text
// input, so this follows the game's panel language (dark fill, thin border, gold
// accent) and monogram font.
import { LEVEL, type LevelId, type PlayerSkin } from "@dc2d/engine";
import { loadTabPreference, saveTabPreference } from "../../net/auth/identity.js";
import { CharacterSelection } from "./characterSelection.js";
import { createReleaseNotesLink, createSpectatorLink } from "./titleLinks.js";

const PANEL_BG = "#1a1a24";
const PANEL_BORDER = "#494956";
const GOLD = "#ffd23d";
const NAME_STORAGE_KEY = "dc2d-name";
const MONOGRAM_FONT = "monogram, monospace";

export function loadStoredName(): string {
  return loadTabPreference(NAME_STORAGE_KEY) ??
    `Crawler${Math.floor(100 + Math.random() * 900)}`;
}
function applyRootStyle(el: HTMLDivElement): void {
  Object.assign(el.style, {
    position: "fixed", left: "50%", bottom: "3%", transform: "translateX(-50%)",
    display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", zIndex: "20",
  });
}
function applyInputStyle(el: HTMLInputElement): void {
  Object.assign(el.style, {
    width: "220px", padding: "10px 12px", background: PANEL_BG, color: "#e8e8e8",
    border: `1px solid ${PANEL_BORDER}`,
    fontFamily: MONOGRAM_FONT, fontSize: "20px", textAlign: "center",
  });
}
function applyButtonStyle(el: HTMLButtonElement): void {
  Object.assign(el.style, {
    padding: "12px 26px", background: PANEL_BG, color: GOLD, border: `1px solid ${GOLD}`,
    fontFamily: MONOGRAM_FONT,
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
    fontFamily: MONOGRAM_FONT,
    fontSize: "16px",
    minHeight: "16px",
  });
}
function createStatus(): HTMLDivElement {
  const status = document.createElement("div");
  applyStatusStyle(status);
  return status;
}
export interface ConnectFormHandlers {
  onConnect(name: string, level: LevelId, skin: PlayerSkin): void;
  /** Lets the renderer suspend global gameplay-key capture while the name field owns typing. */
  onNameInputFocusChange?(focused: boolean): void;
}

export class ConnectForm {
  private readonly root: HTMLDivElement;
  private readonly input: HTMLInputElement;
  private readonly buttons: HTMLButtonElement[] = [];
  private readonly status: HTMLDivElement;
  private readonly character = new CharacterSelection();
  private readonly onNameInputFocusChange?: ConnectFormHandlers["onNameInputFocusChange"];

  constructor(handlers: ConnectFormHandlers) {
    this.onNameInputFocusChange = handlers.onNameInputFocusChange;
    this.root = document.createElement("div");
    this.root.className = "title-connect-form";
    applyRootStyle(this.root);

    this.input = this.createInput(handlers);
    const choices = this.createChoices(handlers);
    this.status = createStatus();
    this.root.append(
      this.character.element,
      this.input,
      choices,
      this.status,
      createSpectatorLink(),
      createReleaseNotesLink(),
    );
    document.body.append(this.root);
    this.input.focus();
  }

  private createInput(handlers: ConnectFormHandlers): HTMLInputElement {
    const input = document.createElement("input");
    input.maxLength = 16; input.value = loadStoredName(); applyInputStyle(input);
    input.addEventListener("focus", () => handlers.onNameInputFocusChange?.(true));
    input.addEventListener("blur", () => handlers.onNameInputFocusChange?.(false));
    input.addEventListener("keydown", (event) => this.handleInputKey(event, handlers));
    return input;
  }

  private handleInputKey(event: KeyboardEvent, handlers: ConnectFormHandlers): void {
    if (event.key !== "Enter") return;
    event.preventDefault(); event.stopPropagation(); this.submit(handlers, LEVEL.Dungeon);
  }

  private createChoices(handlers: ConnectFormHandlers): HTMLDivElement {
    const choices = document.createElement("div");
    choices.style.cssText = "display:flex;gap:10px;flex-wrap:wrap;justify-content:center";
    this.buttons.push(this.createButton({ label: "Enter the Dungeon", detail: "Procedural world · enemies · progression", level: LEVEL.Dungeon, handlers }));
    if (import.meta.env.DEV) {
      this.buttons.push(this.createButton({ label: "Enter the Sandbox", detail: "Traversal course · no enemies", level: LEVEL.Sandbox, handlers }));
      this.buttons.push(this.createButton({ label: "Enter the Combat Sandbox", detail: "Flat arena · equipment · training targets", level: LEVEL.CombatSandbox, handlers }));
    }
    choices.append(...this.buttons);
    return choices;
  }

  private createButton({ label, detail, level, handlers }: ConnectButton): HTMLButtonElement {
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
    saveTabPreference(NAME_STORAGE_KEY, name);
    this.releaseInputFocus();
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
    // Removing a focused DOM node does not consistently dispatch blur across
    // browsers; release the renderer's keyboard-capture suspension explicitly.
    this.releaseInputFocus();
    this.root.remove();
  }

  private releaseInputFocus(): void {
    this.input.blur();
    this.onNameInputFocusChange?.(false);
  }
}

interface ConnectButton { readonly label: string; readonly detail: string; readonly level: LevelId; readonly handlers: ConnectFormHandlers; }
