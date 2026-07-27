/** Presents queued contextual tutorials once per browser profile while allowing recurring health warnings. */
import type { Connection } from "../../../net/connection/connection.js";
import {
  advanceTutorials,
  createTutorialState,
  type TutorialInputMode,
  type TutorialId,
  type TutorialMessage,
} from "../../../ui/tutorials/model.js";
import { createHudTutorialElement } from "./HudTutorialElement.js";
import { clearSeenTutorials, loadSeenTutorials, loadTutorialHistory, persistSeenTutorials, persistTutorialHistory } from "./HudTutorialPersistence.js";

const DISPLAY_MS = 9000;
const PARTY_TOUCH_DISTANCE = 1.2;
const PARTY_HINT =
  "Press [F] when you're touching another player to send them a party invite!";
const LOW_HEALTH_ID: TutorialId = "low-health";

export class HudTutorials {
  readonly element: HTMLDivElement;
  private readonly state = createTutorialState();
  private readonly seen = loadSeenTutorials();
  private readonly queue: TutorialMessage[] = [];
  private readonly history = loadTutorialHistory();
  private active: TutorialMessage | null = null;
  private activeUntil = 0;

  constructor(private readonly mode: TutorialInputMode) {
    this.element = createHudTutorialElement(mode);
  }

  update(
    connection: Connection,
    selectedSlot: number | null,
    nowMs: number,
  ): void {
    if (!this.canUpdate(connection, selectedSlot)) return;
    this.dismissUnavailableLowHealth(connection);
    this.queueTutorialMessages(connection, selectedSlot);
    this.displayNext(nowMs);
  }

  private canUpdate(connection: Connection, selectedSlot: number | null): boolean {
    return connection.hasReceivedSnapshot && !this.showPartyProximityHint(connection, selectedSlot);
  }

  private queueTutorialMessages(connection: Connection, selectedSlot: number | null): void {
    const messages = advanceTutorials(this.state, {
      inventory: connection.inventory,
      hotbar: connection.hotbar,
      selectedSlot,
      hp: connection.hp,
      maxHp: connection.maxHp,
    }, this.mode);
    for (const message of messages) {
      if (message.persistent) this.rememberMessage(message);
      if (!message.persistent || !this.seen.has(message.id)) {
        this.enqueue(message);
      }
    }
  }

  private displayNext(nowMs: number): void {
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

  private showPartyProximityHint(
    connection: Connection,
    selectedSlot: number | null,
  ): boolean {
    if (!partyHintAvailable(connection, selectedSlot, this.mode)) return false;
    this.element.textContent = PARTY_HINT;
    this.element.hidden = false;
    return true;
  }

  replay(): void {
    this.seen.clear();
    clearSeenTutorials();
    this.queue.splice(0, this.queue.length, ...this.history.values());
    this.active = null;
    this.activeUntil = 0;
    this.element.hidden = true;
  }

  private finishActive(): void {
    if (this.active?.persistent) this.remember(this.active.id);
    this.active = null;
  }

  private dismissUnavailableLowHealth(connection: Connection): void {
    if (canShowLowHealth(connection)) return;
    this.removeQueuedLowHealth();
    if (this.active?.id !== LOW_HEALTH_ID) return;
    this.active = null;
    this.activeUntil = 0;
    this.element.hidden = true;
  }

  private enqueue(message: TutorialMessage): void {
    if (message.id === "throwable" || message.id === "usable") {
      this.finishActive();
      this.activeUntil = 0;
      this.queue.unshift(message);
      return;
    }
    if (message.id !== LOW_HEALTH_ID) {
      this.queue.push(message);
      return;
    }
    if (this.active?.persistent) this.queue.unshift(this.active);
    this.active = null;
    this.activeUntil = 0;
    this.queue.unshift(message);
  }

  private removeQueuedLowHealth(): void {
    for (let index = this.queue.length - 1; index >= 0; index -= 1) {
      if (this.queue[index]?.id === LOW_HEALTH_ID) this.queue.splice(index, 1);
    }
  }

  private remember(id: TutorialId): void {
    this.seen.add(id);
    persistSeenTutorials(this.seen);
  }

  private rememberMessage(message: TutorialMessage): void {
    this.history.set(message.id, message);
    persistTutorialHistory(this.history);
  }
}

const partyHintAvailable = (connection: Connection, selectedSlot: number | null, mode: TutorialInputMode): boolean => {
  if (mode !== "keyboard" || connection.party || connection.pendingInvite || connection.outgoingPartyInvites.size || !connection.body) return false;
  if (selectedSlot !== null && connection.hotbar[selectedSlot] === "bandage") return false;
  return [...connection.entities.values()].some(({ snap }) => snap.kind === "player" &&
    Math.hypot(snap.x - connection.body!.x, snap.y - connection.body!.y) <= PARTY_TOUCH_DISTANCE);
};

const canShowLowHealth = (connection: Connection): boolean =>
  connection.maxHp > 0 && connection.hp / connection.maxHp < 0.3 &&
  connection.inventory.some((stack) => stack.item === "bandage" && stack.qty > 0);
