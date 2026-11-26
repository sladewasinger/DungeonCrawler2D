/** Compact proximity chat input bar + auto-fading nearby message feed. */
import { MAX_CHAT_LENGTH, type ChatEntry } from "@dc2d/engine";
import { domNode } from "../hud/slotRenderer.js";
import { ensureChatStyles } from "./chatStyles.js";

const FEED_MAX_LINES = 4;
const FEED_TTL_MS = 8000;

interface FeedItem {
  readonly id: string;
  readonly el: HTMLDivElement;
  readonly expiresAtMs: number;
}

export class ChatOverlay {
  readonly el: HTMLDivElement;
  private readonly feedEl: HTMLDivElement;
  private readonly barEl: HTMLDivElement;
  private readonly inputEl: HTMLInputElement;
  private readonly shoutBtn: HTMLButtonElement;
  private readonly toggleBtn: HTMLButtonElement;
  private readonly feed: FeedItem[] = [];
  private shout = false;
  private onOpenChange?: (open: boolean) => void;

  constructor(host: HTMLElement, private readonly onSend: (text: string, shout: boolean) => void) {
    ensureChatStyles();
    this.el = domNode("div", "ow-chat-ui");
    this.feedEl = domNode("div", "ow-chat-feed");
    this.barEl = domNode("div", "ow-chat-bar");
    this.barEl.hidden = true;

    this.inputEl = domNode("input", "ow-chat-input");
    this.inputEl.type = "text";
    this.inputEl.maxLength = MAX_CHAT_LENGTH;
    this.inputEl.placeholder = "Say nearby (or !shout)...";

    this.shoutBtn = domNode("button", "ow-chat-shout-btn");
    this.shoutBtn.type = "button";
    this.shoutBtn.textContent = "!";
    this.shoutBtn.title = "Toggle Shout (longer range)";
    this.shoutBtn.dataset.active = "false";
    this.shoutBtn.addEventListener("click", () => {
      this.shout = !this.shout;
      this.shoutBtn.dataset.active = String(this.shout);
      this.inputEl.focus();
    });

    const sendBtn = domNode("button", "ow-chat-shout-btn");
    sendBtn.type = "button";
    sendBtn.textContent = "Send";
    sendBtn.addEventListener("click", () => this.submitAndClose());

    this.toggleBtn = domNode("button", "ow-chat-toggle-btn");
    this.toggleBtn.type = "button";
    this.toggleBtn.textContent = "Chat";
    this.toggleBtn.title = "Proximity Chat (Enter)";
    this.toggleBtn.addEventListener("click", () => this.openInput());

    this.barEl.append(this.shoutBtn, this.inputEl, sendBtn);
    this.el.append(this.feedEl, this.barEl, this.toggleBtn);
    this.bindInputKeys();
    host.append(this.el);
  }

  private bindInputKeys(): void {
    this.inputEl.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") { e.preventDefault(); this.submitAndClose(); }
      else if (e.key === "Escape") { e.preventDefault(); this.closeInput(); }
    });
  }

  setOpenListener(cb: (open: boolean) => void): void { this.onOpenChange = cb; }

  isOpen(): boolean { return !this.barEl.hidden; }

  openInput(): void {
    const wasOpen = this.isOpen();
    this.barEl.hidden = false;
    this.toggleBtn.hidden = true;
    this.inputEl.focus();
    if (!wasOpen) this.onOpenChange?.(true);
  }

  closeInput(): void {
    const wasOpen = this.isOpen();
    this.inputEl.value = "";
    this.inputEl.blur();
    this.barEl.hidden = true;
    this.toggleBtn.hidden = false;
    if (wasOpen) this.onOpenChange?.(false);
  }

  private submitAndClose(): void {
    const text = this.inputEl.value.trim();
    if (text) this.onSend(text, this.shout);
    this.closeInput();
  }

  pushMessages(messages: readonly ChatEntry[], nowMs: number): void {
    for (const m of messages) {
      if (this.feed.some((f) => f.id === m.id)) continue;
      const line = domNode("div", "ow-chat-line");
      line.dataset.shout = String(m.shout);
      const nameSpan = domNode("span", "ow-chat-line-name");
      nameSpan.textContent = m.shout ? `${m.senderName} shouts:` : `${m.senderName}:`;
      line.append(nameSpan, document.createTextNode(m.text));
      this.feedEl.append(line);
      this.feed.push({ id: m.id, el: line, expiresAtMs: nowMs + FEED_TTL_MS });
      while (this.feed.length > FEED_MAX_LINES) {
        const old = this.feed.shift();
        old?.el.remove();
      }
    }
    this.pruneExpired(nowMs);
  }

  pruneExpired(nowMs: number): void {
    for (let i = this.feed.length - 1; i >= 0; i--) {
      const item = this.feed[i]!;
      const rem = item.expiresAtMs - nowMs;
      if (rem <= 0) {
        item.el.remove();
        this.feed.splice(i, 1);
      } else if (rem < 800) {
        item.el.style.opacity = String(Math.max(0, rem / 800));
      }
    }
  }
}
