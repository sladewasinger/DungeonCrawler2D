import { describe, expect, it } from "vitest";
import type { ChatPanelModel } from "../../ui/chat/controller.js";
import { buildHudSnapshot, type HudSnapshotSource } from "./hudSnapshot.js";

function source(overrides: Partial<HudSnapshotSource> = {}): HudSnapshotSource {
  return {
    hp: 20,
    maxHp: 30,
    hotbar: [null, null, null, null, null, null, null, null, null],
    inventory: [],
    weapon: null,
    fx: [],
    pingMs: 40,
    connected: true,
    reconnecting: false,
    downed: false,
    ...overrides,
  };
}

/** Neutral fps/bodyPos/chat/contacts args for tests that don't care about those fields. */
const FPS = 60;
const BODY_POS = { x: 0, y: 0 };
const CHAT_MODEL: ChatPanelModel = { tabs: [], lines: [] };
const CONTACTS: never[] = [];

function snapshotOf(src: HudSnapshotSource, armedThrowableSlot = null as number | null, fps = FPS, bodyPos = BODY_POS) {
  return buildHudSnapshot(src, armedThrowableSlot, null, null, fps, bodyPos, CHAT_MODEL, CONTACTS);
}

describe("buildHudSnapshot", () => {
  it("maps health/ping/connection straight through", () => {
    const snap = snapshotOf(source({ hp: 5, maxHp: 30, pingMs: 99 }));
    expect(snap.health).toEqual({ hp: 5, maxHp: 30 });
    expect(snap.pingMs).toBe(99);
    expect(snap.connected).toBe(true);
  });

  it("fills hotbar counts from inventory stacks", () => {
    const hotbar = ["sword", null, "bandage", null, null, null, null, null, null];
    const inventory = [{ item: "sword", qty: 1 }, { item: "bandage", qty: 3 }];
    const snap = snapshotOf(source({ hotbar, inventory }));
    expect(snap.hotbar[0]).toEqual({ itemId: "sword", count: 1 });
    expect(snap.hotbar[2]).toEqual({ itemId: "bandage", count: 3 });
    expect(snap.hotbar[1]).toEqual({ itemId: null, count: 0 });
  });

  it("highlights the hotbar slot holding the equipped weapon", () => {
    const hotbar = [null, "sword", null, null, null, null, null, null, null];
    const snap = snapshotOf(source({ hotbar, weapon: "sword" }));
    expect(snap.selectedSlot).toBe(1);
  });

  it("selects -1 when unarmed", () => {
    const snap = snapshotOf(source({ weapon: null }));
    expect(snap.selectedSlot).toBe(-1);
  });

  it("resolves buff kind/duration from content, defaulting unknown ids to a debuff", () => {
    const snap = snapshotOf(source({ fx: ["on-fire", "regenerating", "made-up"] }));
    expect(snap.buffs).toContainEqual({ statusId: "on-fire", kind: "debuff", remainingSec: 5, durationSec: 5 });
    expect(snap.buffs).toContainEqual({
      statusId: "regenerating",
      kind: "buff",
      remainingSec: 20,
      durationSec: 20,
    });
    expect(snap.buffs).toContainEqual({ statusId: "made-up", kind: "debuff", remainingSec: 1, durationSec: 1 });
  });

  it("passes the chat model and contacts straight through (owned by ui/chat/controller.ts)", () => {
    const chatModel: ChatPanelModel = {
      tabs: [{ id: "global", active: true, unread: false, dim: false }],
      lines: [{ channel: "global", author: "server", text: "welcome" }],
    };
    const contacts = [{ name: "Wren", online: true }];
    const snap = buildHudSnapshot(source(), null, null, null, FPS, BODY_POS, chatModel, contacts);
    expect(snap.chatModel).toBe(chatModel);
    expect(snap.contacts).toEqual(contacts);
  });

  it("passes through armedThrowableSlot, interactionPrompt, and touch unchanged", () => {
    const prompt = { key: "E", label: "interact" };
    const touch = { stick: null, buttons: { attack: false, jump: false, interact: false } };
    const snap = buildHudSnapshot(source(), 3, prompt, touch, FPS, BODY_POS, CHAT_MODEL, CONTACTS);
    expect(snap.armedThrowableSlot).toBe(3);
    expect(snap.interactionPrompt).toBe(prompt);
    expect(snap.touch).toBe(touch);
  });

  it("passes fps straight through for the top-right indicator's own smoothing", () => {
    const snap = snapshotOf(source(), null, 47);
    expect(snap.fps).toBe(47);
  });

  it("rounds the predicted body position into whole-tile coords", () => {
    const snap = snapshotOf(source(), null, FPS, { x: 128.4, y: -63.6 });
    expect(snap.coords).toEqual({ x: 128, y: -64 });
  });

  it("builds one inventory row per InvStack, tagging its hotbar-bound slot (or null when unbound)", () => {
    const hotbar = ["sword", null, null, null, null, null, null, null, null];
    const inventory = [
      { item: "sword", qty: 1 },
      { item: "rag", qty: 6 },
    ];
    const snap = snapshotOf(source({ hotbar, inventory }));
    expect(snap.inventory).toEqual([
      { itemId: "sword", name: "Rusty Sword", qty: 1, category: "weapons", boundSlot: 0 },
      { itemId: "rag", name: "Rag", qty: 6, category: "materials", boundSlot: null },
    ]);
  });
});
