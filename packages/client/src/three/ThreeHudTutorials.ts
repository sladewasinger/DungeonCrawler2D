/** Presents queued contextual tutorials once per browser profile while allowing recurring health warnings. */
import type { Connection } from "../net/connection.js";
import {
  advanceTutorials,
  createTutorialState,
  type TutorialId,
  type TutorialMessage,
} from "../ui/tutorials/model.js";
import { HUD_GOLD } from "./ThreeHudStyles.js";

const STORAGE_KEY = "dc2d.hud.tutorials.v1";
const DISPLAY_MS = 5200;

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

export class ThreeHudTutorials {
  readonly element = document.createElement("div");
  private readonly state = createTutorialState();
  private readonly seen = loadSeen();
  private readonly queue: TutorialMessage[] = [];
  private activeUntil = 0;

  constructor() {
    this.element.hidden = true;
    this.element.style.cssText =
      "position:absolute;left:50%;bottom:18%;translate:-50% 0;z-index:1100;" +
      "max-width:min(520px,78vw);padding:8px 12px;text-align:center;" +
      "background:rgba(17,18,29,.82);border:1px solid rgba(255,213,76,.58);" +
      `color:${HUD_GOLD};font:12px monospace;pointer-events:none;` +
      "box-shadow:0 7px 20px rgba(0,0,0,.34)";
  }

  update(connection: Connection, nowMs: number): void {
    const messages = advanceTutorials(this.state, {
      inventory: connection.inventory,
      hotbar: connection.hotbar,
      hp: connection.hp,
      maxHp: connection.maxHp,
    });
    for (const message of messages) {
      if (!message.persistent || !this.seen.has(message.id)) this.queue.push(message);
    }
    if (!this.element.hidden && nowMs < this.activeUntil) return;
    const next = this.queue.shift();
    if (!next) {
      this.element.hidden = true;
      return;
    }
    this.element.textContent = next.text;
    this.element.hidden = false;
    this.activeUntil = nowMs + DISPLAY_MS;
    if (next.persistent) this.remember(next.id);
  }

  private remember(id: TutorialId): void {
    this.seen.add(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.seen]));
  }
}
