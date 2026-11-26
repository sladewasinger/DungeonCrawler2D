/** Server-authoritative proximity chat, rate limiting, and overhead speech bubble timers. */
import {
  CHAT_BUBBLE_DURATION_SEC, MAX_CHAT_LENGTH, PROXIMITY_CHAT_RADIUS, PROXIMITY_SHOUT_RADIUS,
  type ChatEntry, type PlayerBubble,
} from "@dc2d/engine";

const RATE_WINDOW_MS = 5000;
const RATE_MAX_MSGS = 4;

function stripControlChars(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    out += raw.charCodeAt(i) < 32 ? " " : raw[i];
  }
  return out.replace(/\s+/g, " ").trim();
}

function sanitizeChatText(raw: string): { readonly text: string; readonly forceShout: boolean } | null {
  const cleaned = stripControlChars(raw);
  if (!cleaned) return null;
  const isCmd = /^\/(shout|s)\s+/i.test(cleaned);
  if (isCmd || (cleaned.startsWith("!") && cleaned.length > 1)) {
    const body = (isCmd ? cleaned.replace(/^\/(shout|s)\s+/i, "") : cleaned.slice(1)).trim().slice(0, MAX_CHAT_LENGTH);
    return body ? { text: body, forceShout: true } : null;
  }
  return { text: cleaned.slice(0, MAX_CHAT_LENGTH), forceShout: false };
}

export class ProximityChatManager {
  private readonly bubbles = new Map<string, { text: string; shout: boolean; remainingSec: number }>();
  private readonly rateLog = new Map<string, number[]>();
  private pending: ChatEntry[] = [];
  private nextId = 1;

  removePlayer(playerId: string): void {
    this.bubbles.delete(playerId);
    this.rateLog.delete(playerId);
  }

  sendMessage(opts: {
    readonly senderId: string;
    readonly senderName: string;
    readonly x: number;
    readonly y: number;
    readonly rawText: string;
    readonly shout?: boolean | undefined;
    readonly tick: number;
    readonly nowMs?: number | undefined;
  }): ChatEntry | null {
    const parsed = sanitizeChatText(opts.rawText);
    if (!parsed) return null;
    const now = opts.nowMs ?? Date.now();
    const recent = (this.rateLog.get(opts.senderId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
    if (recent.length >= RATE_MAX_MSGS) return null;
    recent.push(now);
    this.rateLog.set(opts.senderId, recent);

    const shout = Boolean(opts.shout || parsed.forceShout);
    this.bubbles.set(opts.senderId, { text: parsed.text, shout, remainingSec: CHAT_BUBBLE_DURATION_SEC });
    const entry: ChatEntry = {
      id: `chat-${this.nextId++}`,
      senderId: opts.senderId,
      senderName: opts.senderName,
      text: parsed.text,
      shout,
      x: opts.x,
      y: opts.y,
      sentAtTick: opts.tick,
    };
    this.pending.push(entry);
    return entry;
  }

  step(dt: number): void {
    for (const [id, b] of this.bubbles) {
      b.remainingSec -= dt;
      if (b.remainingSec <= 0) this.bubbles.delete(id);
    }
  }

  activeBubbleFor(playerId: string): PlayerBubble | undefined {
    const b = this.bubbles.get(playerId);
    if (!b) return undefined;
    return { text: b.text, ...(b.shout ? { shout: true } : {}), remainingSec: Number(b.remainingSec.toFixed(2)) };
  }

  drainMessages(): ChatEntry[] {
    if (this.pending.length === 0) return [];
    const out = this.pending;
    this.pending = [];
    return out;
  }
}

export function isWithinChatRadius(opts: {
  readonly ax: number; readonly ay: number; readonly bx: number; readonly by: number; readonly shout?: boolean | undefined;
}): boolean {
  const r = opts.shout ? PROXIMITY_SHOUT_RADIUS : PROXIMITY_CHAT_RADIUS;
  const dx = opts.ax - opts.bx;
  const dy = opts.ay - opts.by;
  return dx * dx + dy * dy <= r * r;
}
