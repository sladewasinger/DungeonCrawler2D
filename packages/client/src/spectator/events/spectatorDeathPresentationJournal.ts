import {
  TICK_RATE,
  type SpectatorDeathPresentation,
  type SpectatorPresentation,
} from "@dc2d/engine";
import type { DeathVisualEvent } from "../../net/connection/connectionTypes.js";

const RETENTION_TICKS = 60 * TICK_RATE;
const TICK_MS = 1000 / TICK_RATE;
const PRESENTED_KEY_CAP = 96;

export class SpectatorDeathPresentationJournal {
  private readonly pending = new Map<string, SpectatorDeathPresentation>();
  private readonly presentedUntil = new Map<string, number>();
  private worldIdentity: string | null = null;

  ingest(message: SpectatorPresentation): void {
    this.pending.clear();
    this.worldIdentity = message.worldIdentity;
    this.prunePresented(message.tick);
    for (const death of message.deaths) this.queue(message, death);
  }

  markLiveDeath(tick: number, id: string): void {
    if (!this.worldIdentity) return;
    const key = deathKey(this.worldIdentity, tick, id);
    this.pending.delete(key);
    this.markPresented(key, tick + RETENTION_TICKS);
  }

  drain(currentTick: number): DeathVisualEvent[] {
    const deaths = [...this.pending].map(([key, death]) => {
      this.markPresented(key, death.occurredAtTick + RETENTION_TICKS);
      return retainedDeathEvent(death, currentTick);
    });
    this.pending.clear();
    this.prunePresented(currentTick);
    return deaths;
  }

  reset(): void {
    this.pending.clear();
    this.presentedUntil.clear();
    this.worldIdentity = null;
  }

  private queue(
    message: SpectatorPresentation,
    death: SpectatorDeathPresentation,
  ): void {
    if (message.tick - death.occurredAtTick >= RETENTION_TICKS) return;
    const key = deathKey(message.worldIdentity, death.occurredAtTick, death.id);
    if (!this.presentedUntil.has(key)) this.pending.set(key, death);
  }

  private prunePresented(currentTick: number): void {
    for (const [key, expiresAtTick] of this.presentedUntil) {
      if (expiresAtTick <= currentTick) this.presentedUntil.delete(key);
    }
  }

  private markPresented(key: string, expiresAtTick: number): void {
    this.presentedUntil.set(key, expiresAtTick);
    while (this.presentedUntil.size > PRESENTED_KEY_CAP) {
      const oldestKey = this.presentedUntil.keys().next().value;
      if (oldestKey === undefined) return;
      this.presentedUntil.delete(oldestKey);
    }
  }
}

function deathKey(worldIdentity: string, tick: number, id: string): string {
  return `${worldIdentity}:${tick}:${id}`;
}

function retainedDeathEvent(
  death: SpectatorDeathPresentation,
  currentTick: number,
): DeathVisualEvent {
  return {
    t: "death",
    id: death.id,
    occurredAtTick: death.occurredAtTick,
    x: death.x,
    y: death.y,
    targetKind: death.targetKind,
    ...(death.defId === undefined ? {} : { defId: death.defId }),
    ...(death.skin === undefined ? {} : { skin: death.skin }),
    persistentOnly: true,
    ageMs: Math.max(0, currentTick - death.occurredAtTick) * TICK_MS,
  };
}
