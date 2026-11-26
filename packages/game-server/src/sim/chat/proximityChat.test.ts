/** Unit tests for proximity chat radius filtering, shout prefixes, and rate limiting. */
import { describe, expect, it } from "vitest";
import { PROXIMITY_CHAT_RADIUS, PROXIMITY_SHOUT_RADIUS } from "@dc2d/engine";
import { ProximityChatManager, isWithinChatRadius } from "./proximityChat.js";

describe("ProximityChatManager", () => {
  it("normalizes shout prefixes, strips control characters, and decays bubble timers", () => {
    const chat = new ProximityChatManager();
    const entry = chat.sendMessage({
      senderId: "p1", senderName: "Hero", x: 10, y: 10,
      rawText: "  !Help   at\nruins!  ", tick: 12, nowMs: 1000,
    });
    expect(entry).not.toBeNull();
    expect(entry?.shout).toBe(true);
    expect(entry?.text).toBe("Help at ruins!");
    expect(chat.activeBubbleFor("p1")?.shout).toBe(true);

    chat.step(6.0);
    expect(chat.activeBubbleFor("p1")).toBeUndefined();
    expect(chat.drainMessages()).toHaveLength(1);
    expect(chat.drainMessages()).toHaveLength(0);
  });

  it("enforces rate limiting per player within 5 seconds", () => {
    const chat = new ProximityChatManager();
    for (let i = 0; i < 4; i++) {
      expect(chat.sendMessage({ senderId: "p1", senderName: "A", x: 0, y: 0, rawText: `hi ${i}`, tick: i, nowMs: 1000 + i * 100 })).not.toBeNull();
    }
    expect(chat.sendMessage({ senderId: "p1", senderName: "A", x: 0, y: 0, rawText: "spam", tick: 5, nowMs: 1500 })).toBeNull();
    expect(chat.sendMessage({ senderId: "p1", senderName: "A", x: 0, y: 0, rawText: "later", tick: 6, nowMs: 7000 })).not.toBeNull();
  });

  it("filters normal vs shout messages by Euclidean distance", () => {
    expect(isWithinChatRadius({ ax: 0, ay: 0, bx: PROXIMITY_CHAT_RADIUS - 1, by: 0, shout: false })).toBe(true);
    expect(isWithinChatRadius({ ax: 0, ay: 0, bx: PROXIMITY_CHAT_RADIUS + 1, by: 0, shout: false })).toBe(false);
    expect(isWithinChatRadius({ ax: 0, ay: 0, bx: PROXIMITY_SHOUT_RADIUS - 1, by: 0, shout: true })).toBe(true);
    expect(isWithinChatRadius({ ax: 0, ay: 0, bx: PROXIMITY_SHOUT_RADIUS + 1, by: 0, shout: true })).toBe(false);
  });
});
