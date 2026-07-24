/** Owns the tabbed, wrapping, scrollable HTML chat window and focus contract. */
import type { Connection } from "../net/connection.js";
import {
  ChatController,
  type ChatTabView,
  type RenderChatLine,
} from "../ui/chat/controller.js";
import type { ChatTabId } from "../ui/chat/chatTabs.js";
import { HUD_GOLD, HUD_PANEL } from "./ThreeHudStyles.js";

const createInput = (mobile: boolean) => {
  const input = document.createElement("input");
  input.placeholder = "press Enter to chat";
  input.maxLength = 500;
  input.style.cssText =
    `width:100%;box-sizing:border-box;padding:${mobile ? 5 : 7}px;` +
    "background:#131421;color:#f2f0eb;border:1px solid #555a75;font:12px monospace";
  return input;
};

export class ThreeHudChat {
  readonly element = document.createElement("div");
  private readonly tabs = document.createElement("div");
  private readonly lines = document.createElement("div");
  private readonly input: HTMLInputElement;
  private readonly chat: ChatController;
  private renderedSeq = -1;

  constructor(
    private readonly connection: Connection,
    mobile: boolean,
    private readonly focusGame: () => void,
  ) {
    this.chat = new ChatController(connection);
    this.input = createInput(mobile);
    this.element.style.cssText =
      `${HUD_PANEL};display:grid;grid-template-rows:auto 1fr auto;gap:6px`;
    this.tabs.style.cssText = "display:grid;grid-template-columns:repeat(4,1fr);gap:3px";
    this.lines.style.cssText =
      "min-height:0;overflow-y:auto;display:flex;flex-direction:column;" +
      "gap:5px;color:#d4d1df;overflow-wrap:anywhere;white-space:pre-wrap";
    this.input.addEventListener("keydown", (event) => this.submit(event));
    this.element.append(this.tabs, this.lines, this.input);
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
    this.tabs.replaceChildren(...model.tabs.map((tab) => this.createTab(tab)));
    this.lines.replaceChildren(...model.lines.map((line) => this.createLine(line)));
    this.lines.scrollTop = this.lines.scrollHeight;
  }

  private createTab(tab: ChatTabView): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${tab.id}${tab.unread ? " •" : ""}`;
    button.style.cssText =
      `padding:4px 2px;border:1px solid ${
        tab.active ? HUD_GOLD : "#555a75"
      };background:#1b1c2c;color:${
        tab.active ? HUD_GOLD : "#e6e5ef"
      };opacity:${tab.dim ? ".45" : "1"};font:10px monospace;pointer-events:auto`;
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
}
