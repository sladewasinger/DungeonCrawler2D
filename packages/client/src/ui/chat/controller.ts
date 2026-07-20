/**
 * ChatController: owns the chat surface's client state — tab selection/unread,
 * the merged display log (server lines + client-local /help/error lines), and
 * submit dispatch through the parser to network intents. Lives with the live
 * Connection (DungeonScene); the chat panel widget renders its model() output.
 */
import { parseChatInput, type ChatCommand } from "./commands.js";
import {
  CHAT_TABS,
  createChatTabsState,
  lastDmPartner,
  lineVisibleOn,
  recordIncoming,
  selectTab,
  type ChatTabId,
  type ChatTabsState,
} from "./chatTabs.js";

/** The Connection surface the controller drives — structural, for headless tests. */
export interface ChatPort {
  readonly chatLog: readonly { channel: string; name: string; text: string; target?: string }[];
  readonly chatSeq: number;
  chat(channel: "party" | "local" | "global" | "dm", text: string, target?: string): void;
  who(): void;
  debugGod(on?: boolean): void;
  debugTeleport(x: number, y: number): void;
}

export interface RenderChatLine {
  channel: string;
  author: string;
  text: string;
  target?: string;
}

export interface ChatTabView {
  id: ChatTabId;
  active: boolean;
  unread: boolean;
  /** dm renders dimmed until its first traffic (the "lights on first dm" brief note). */
  dim: boolean;
}

export interface ChatPanelModel {
  tabs: ChatTabView[];
  /** Already filtered to the active tab (system lines included), oldest first. */
  lines: RenderChatLine[];
}

const DISPLAY_CAP = 60;

export class ChatController {
  private readonly tabs: ChatTabsState = createChatTabsState();
  private readonly display: RenderChatLine[] = [];
  private seenSeq = 0;

  constructor(private readonly port: ChatPort) {}

  /** Pulls newly-arrived server lines into the display log — call once per frame. */
  sync(): void {
    const fresh = this.port.chatSeq - this.seenSeq;
    if (fresh <= 0) return;
    this.seenSeq = this.port.chatSeq;
    for (const line of this.port.chatLog.slice(-fresh)) {
      recordIncoming(this.tabs, line.channel);
      this.pushLine({
        channel: line.channel,
        author: line.name,
        text: line.text,
        ...(line.target !== undefined ? { target: line.target } : {}),
      });
    }
  }

  /** Parses and dispatches one submitted chat-input line. */
  submit(raw: string): void {
    this.dispatch(parseChatInput(raw, this.tabs.active, this.dmPartner()));
  }

  private dispatch(command: ChatCommand): void {
    if (command.kind === "send") this.port.chat(command.channel, command.text, command.target);
    else if (command.kind === "who") this.port.who();
    else if (command.kind === "local-lines") {
      for (const text of command.lines) this.pushSystem(text);
    } else if (command.kind === "error") this.pushSystem(command.message);
    else if (command.kind === "debug-god") this.port.debugGod();
    else if (command.kind === "debug-teleport") this.port.debugTeleport(command.x, command.y);
  }

  selectTab(tab: ChatTabId): void {
    selectTab(this.tabs, tab);
  }

  activeTab(): ChatTabId {
    return this.tabs.active;
  }

  /** The current /r-and-dm-tab reply target — most recent dm thread in either direction. */
  dmPartner(): string | null {
    return lastDmPartner(this.display.map((l) => ({ channel: l.channel, ...(l.target !== undefined ? { target: l.target } : {}) })));
  }

  /** The render model the chat panel widget draws each frame. */
  model(maxLines: number): ChatPanelModel {
    return {
      tabs: CHAT_TABS.map((id) => ({
        id,
        active: id === this.tabs.active,
        unread: this.tabs.unread[id],
        dim: id === "dm" && !this.tabs.dmSeen,
      })),
      lines: this.display.filter((l) => lineVisibleOn(l.channel, this.tabs.active)).slice(-maxLines),
    };
  }

  private pushSystem(text: string): void {
    this.pushLine({ channel: "system", author: "system", text });
  }

  private pushLine(line: RenderChatLine): void {
    this.display.push(line);
    if (this.display.length > DISPLAY_CAP) this.display.shift();
  }
}
