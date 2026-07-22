import { ChatController } from "../ui/chat/controller.js";
import type { Connection } from "../net/connection.js";

const createInput = (mobile: boolean) => {
  const input = document.createElement("input");
  input.placeholder = "press Enter to chat";
  input.style.cssText = `width:100%;box-sizing:border-box;padding:${mobile ? 5 : 7}px;background:#131421;color:#f2f0eb;border:1px solid #555a75;font:12px monospace`;
  return input;
};

export class ThreeHudChat {
  readonly element = document.createElement("div");
  private readonly lines = document.createElement("div");
  private readonly input: HTMLInputElement;
  private readonly chat: ChatController;
  private readonly maxLines: number;
  private renderedSeq = -1;

  constructor(private readonly connection: Connection, mobile: boolean, private readonly focusGame: () => void) {
    this.chat = new ChatController(connection);
    this.maxLines = mobile ? 5 : 8;
    this.input = createInput(mobile);
    this.lines.style.cssText = `min-height:${mobile ? 92 : 128}px;display:flex;flex-direction:column;gap:5px;color:#d4d1df`;
    this.input.addEventListener("keydown", (event) => this.submit(event));
    this.element.append(this.lines, this.input);
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

  ownsFocus(): boolean {
    return document.activeElement === this.input;
  }

  leave(): void {
    this.input.blur();
    this.focusGame();
  }

  private submit(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key !== "Enter" || !this.input.value.trim()) return;
    this.chat.submit(this.input.value);
    this.input.value = "";
    this.render();
    this.renderedSeq = this.connection.chatSeq;
    this.leave();
  }

  private render(): void {
    const lines = this.chat.model(this.maxLines).lines;
    this.lines.replaceChildren(...lines.map((line) => this.createLine(line.author, line.text)));
  }

  private createLine(author: string, text: string): HTMLDivElement {
    const entry = document.createElement("div");
    entry.textContent = `${author}: ${text}`;
    return entry;
  }
}
