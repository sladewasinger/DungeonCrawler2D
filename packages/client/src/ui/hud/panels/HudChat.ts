/** Owns the tabbed, wrapping, scrollable HTML chat window and focus contract. */
import type { Connection } from "../../../net/connection/connection.js";
import {
  ChatController,
  type ChatTabView,
  type RenderChatLine,
} from "../../../ui/chat/controller.js";
import type { ChatTabId } from "../../../ui/chat/chatTabs.js";
import { createHudTemplate, requireHudElement } from "../styles/hudTemplate.js";

export class HudChat {
  readonly element: HTMLElement;
  private readonly tabs: HTMLElement;
  private readonly lines: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly chat: ChatController;
  private readonly connection: Connection;
  private readonly focusGame: () => void;
  private readonly toggleContacts: () => void;
  private renderedSeq = -1;

  constructor({ connection, focusGame, setTextInputFocused, toggleContacts }: HudChatOptions) {
    this.connection = connection;
    this.focusGame = focusGame;
    this.toggleContacts = toggleContacts;
    this.chat = new ChatController(connection);
    this.element = createHudTemplate<HTMLElement>("hud-chat-template");
    this.tabs = requireHudElement(this.element, "[data-hud-chat-tabs]");
    this.lines = requireHudElement(this.element, "[data-hud-chat-lines]");
    this.input = requireHudElement<HTMLInputElement>(this.element, "[data-hud-chat-input]");
    this.input.addEventListener("keydown", (event) => this.submit(event));
    this.input.addEventListener("focus", () => setTextInputFocused(true));
    this.input.addEventListener("blur", () => setTextInputFocused(false));
    this.input.addEventListener("pointerdown", this.preventIdlePointerFocus);
    document.addEventListener("pointerdown", this.leaveOnOutsidePointer, true);
    this.render();
  }

  update(): void {
    if (this.renderedSeq === this.connection.chatSeq) return;
    this.chat.sync();
    this.render();
    this.renderedSeq = this.connection.chatSeq;
  }

  focus(): void {
    this.input.focus();
  }

  startDm(name: string): void {
    this.chat.selectTab("dm");
    this.input.value = `/dm ${name} `;
    this.render();
    this.focus();
    this.input.setSelectionRange(this.input.value.length, this.input.value.length);
  }

  ownsFocus(): boolean {
    return document.activeElement === this.input;
  }

  leave(): void {
    this.input.blur();
    this.focusGame();
  }

  dispose(): void {
    document.removeEventListener("pointerdown", this.leaveOnOutsidePointer, true);
    this.input.removeEventListener("pointerdown", this.preventIdlePointerFocus);
  }

  private readonly preventIdlePointerFocus = (event: PointerEvent): void => {
    if (this.ownsFocus()) return;
    event.preventDefault();
    this.focusGame();
  };

  private readonly leaveOnOutsidePointer = (event: PointerEvent): void => {
    if (!this.ownsFocus() || this.element.contains(event.target as Node)) return;
    this.leave();
  };

  private submit(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      this.leave();
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (this.input.value.trim()) this.chat.submit(this.input.value);
    this.input.value = "";
    this.render();
    this.renderedSeq = this.connection.chatSeq;
    this.leave();
  }

  private render(): void {
    const model = this.chat.model(60);
    const contacts = createHudTemplate<HTMLButtonElement>("hud-chat-tab-template");
    contacts.textContent = "contacts";
    contacts.setAttribute("aria-label", "Toggle contacts");
    contacts.className = "hud-chat__tab";
    contacts.addEventListener("click", this.toggleContacts);
    this.tabs.replaceChildren(
      ...model.tabs.map((tab) => this.createTab(tab)),
      contacts,
    );
    this.lines.replaceChildren(...model.lines.map((line) => this.createLine(line)));
    this.lines.scrollTop = this.lines.scrollHeight;
  }

  private createTab(tab: ChatTabView): HTMLButtonElement {
    const button = createHudTemplate<HTMLButtonElement>("hud-chat-tab-template");
    button.textContent = `${tab.id}${tab.unread ? " •" : ""}`;
    button.className = [
      "hud-chat__tab",
      tab.active ? "hud-chat__tab--active" : "",
      tab.dim ? "hud-chat__tab--dim" : "",
    ].filter(Boolean).join(" ");
    button.addEventListener("click", () => this.selectTab(tab.id));
    return button;
  }

  private selectTab(tab: ChatTabId): void {
    this.chat.selectTab(tab);
    this.render();
  }

  private createLine(line: RenderChatLine): HTMLDivElement {
    const entry = createHudTemplate<HTMLDivElement>("hud-chat-line-template");
    const author = requireHudElement(entry, "[data-hud-chat-author]");
    const text = requireHudElement(entry, "[data-hud-chat-text]");
    author.textContent = `${line.author}: `;
    entry.dataset.author = line.author;
    text.textContent = line.text;
    return entry;
  }
}

export interface HudChatOptions {
  connection: Connection;
  focusGame: () => void;
  setTextInputFocused: (focused: boolean) => void;
  toggleContacts: () => void;
}
