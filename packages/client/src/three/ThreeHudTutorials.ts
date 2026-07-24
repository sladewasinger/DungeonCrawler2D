/** Presents queued contextual tutorials once per browser profile while allowing recurring health warnings. */
import type { Connection } from "../net/connection.js";
import {
  advanceTutorials,
  createTutorialState,
  type TutorialInputMode,
  type TutorialId,
  type TutorialMessage,
} from "../ui/tutorials/model.js";
import { HUD_GOLD } from "./ThreeHudStyles.js";

const STORAGE_KEY = "dc2d.hud.tutorials.v1";
const HISTORY_STORAGE_KEY = "dc2d.hud.tutorial-history.v1";
const DISPLAY_MS = 9000;

const loadSeen = (): Set<TutorialId> => {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(value)
      ? new Set(value.filter((entry): entry is TutorialId => typeof entry === "string"))
      : new Set();
  } catch {
    return new Set();
  }
};

const loadHistory = (): Map<TutorialId, TutorialMessage> => {
  try {
    const value = JSON.parse(
      localStorage.getItem(HISTORY_STORAGE_KEY) ?? "[]",
    ) as unknown;
    if (!Array.isArray(value)) return new Map();
    const messages = value.filter((entry): entry is TutorialMessage =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as TutorialMessage).id === "string" &&
      typeof (entry as TutorialMessage).text === "string" &&
      (entry as TutorialMessage).persistent === true);
    return new Map(messages.map((message) => [message.id, message]));
  } catch {
    return new Map();
  }
};

export class ThreeHudTutorials {
  readonly element = document.createElement("div");
  private readonly state = createTutorialState();
  private readonly seen = loadSeen();
  private readonly queue: TutorialMessage[] = [];
  private readonly history = loadHistory();
  private active: TutorialMessage | null = null;
  private activeUntil = 0;

  constructor(private readonly mode: TutorialInputMode) {
    this.element.hidden = true;
    this.element.setAttribute("role", "status");
    this.element.setAttribute("aria-live", "polite");
    this.element.setAttribute("aria-atomic", "true");
    this.element.style.cssText =
      "position:absolute;left:50%;bottom:18%;translate:-50% 0;z-index:1100;" +
      "max-width:min(520px,78vw);padding:8px 12px;text-align:center;" +
      "background:rgba(17,18,29,.82);border:1px solid rgba(255,213,76,.58);" +
      `color:${HUD_GOLD};font:${mode === "touch" ? 14 : 12}px monospace;pointer-events:none;` +
      "box-shadow:0 7px 20px rgba(0,0,0,.34)";
  }

  update(connection: Connection, nowMs: number): void {
    if (!connection.hasReceivedSnapshot) return;
    this.dismissRecoveredLowHealth(connection);
    const messages = advanceTutorials(this.state, {
      inventory: connection.inventory,
      hotbar: connection.hotbar,
      hp: connection.hp,
      maxHp: connection.maxHp,
    }, this.mode);
    for (const message of messages) {
      if (message.persistent) this.rememberMessage(message);
      if (!message.persistent || !this.seen.has(message.id)) {
        this.enqueue(message);
      }
    }
    if (this.active && nowMs < this.activeUntil) return;
    this.finishActive();
    const next = this.queue.shift();
    if (!next) {
      this.element.hidden = true;
      return;
    }
    this.element.textContent = next.text;
    this.element.hidden = false;
    this.active = next;
    this.activeUntil = nowMs + DISPLAY_MS;
  }

  replay(): void {
    this.seen.clear();
    localStorage.removeItem(STORAGE_KEY);
    this.queue.splice(0, this.queue.length, ...this.history.values());
    this.active = null;
    this.activeUntil = 0;
    this.element.hidden = true;
  }

  private finishActive(): void {
    if (this.active?.persistent) this.remember(this.active.id);
    this.active = null;
  }

  private dismissRecoveredLowHealth(connection: Connection): void {
    const healthIsLow = connection.maxHp > 0 && connection.hp / connection.maxHp < 0.3;
    if (healthIsLow) return;
    for (let index = this.queue.length - 1; index >= 0; index -= 1) {
      if (this.queue[index]?.id === "low-health") this.queue.splice(index, 1);
    }
    if (this.active?.id !== "low-health") return;
    this.active = null;
    this.activeUntil = 0;
    this.element.hidden = true;
  }

  private enqueue(message: TutorialMessage): void {
    if (message.id !== "low-health") {
      this.queue.push(message);
      return;
    }
    if (this.active?.persistent) this.queue.unshift(this.active);
    this.active = null;
    this.activeUntil = 0;
    this.queue.unshift(message);
  }

  private remember(id: TutorialId): void {
    this.seen.add(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.seen]));
  }

  private rememberMessage(message: TutorialMessage): void {
    this.history.set(message.id, message);
    localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify([...this.history.values()]),
    );
  }
}
