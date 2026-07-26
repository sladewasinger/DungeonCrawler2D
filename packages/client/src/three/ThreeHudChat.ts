/** Owns the tabbed, wrapping, scrollable HTML chat window and focus contract. */
import type { Connection } from "../net/connection.js";
import {
  ChatController,
  type ChatTabView,
  type RenderChatLine,
} from "../ui/chat/controller.js";
import type { ChatTabId } from "../ui/chat/chatTabs.js";
import { HUD_GOLD } from "./ThreeHudStyles.js";
import { createHudTemplate } from "./hudTemplate.js";

export class ThreeHudChat {
  readonly element: HTMLElement;
  private readonly tabs: HTMLElement;
  private readonly lines: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly chat: ChatController;
  private renderedSeq = -1;

  constructor(
    private readonly connection: Connection,
    _mobile: boolean,
    private readonly focusGame: () => void,
    setTextInputFocused: (focused: boolean) => void,
    private readonly toggleContacts: () => void,
  ) {
    this.chat = new ChatController(connection);
    this.element = createHudTemplate<HTMLElement>("hud-chat-template");
    this.tabs = this.requireElement("[data-hud-chat-tabs]");
    this.lines = this.requireElement("[data-hud-chat-lines]");
    this.input = this.requireElement<HTMLInputElement>("[data-hud-chat-input]");
    this.input.addEventListener("keydown", (event) => this.submit(event));
    this.input.addEventListener("focus", () => setTextInputFocused(true));
    this.input.addEventListener("blur", () => setTextInputFocused(false));
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
    const contacts = document.createElement("button");
    contacts.type = "button";
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
    const button = document.createElement("button");
    button.type = "button";
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
    const entry = document.createElement("div");
    const author = document.createElement("strong");
    author.textContent = `${line.author}: `;
    author.style.color = line.author === "system" ? HUD_GOLD : "#f2f0eb";
    entry.append(author, document.createTextNode(line.text));
    return entry;
  }

  private requireElement<T extends HTMLElement>(selector: string): T {
    const element = this.element.querySelector<T>(selector);
    if (!element) throw new Error(`Missing chat HUD element: ${selector}`);
    return element;
  }
}
