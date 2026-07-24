import { describe, expect, it } from "vitest";
import type { ChatPanelModel } from "../../ui/chat/controller.js";
import { buildHudSnapshot, type HudSnapshotSource } from "./hudSnapshot.js";

function source(overrides: Partial<HudSnapshotSource> = {}): HudSnapshotSource {
  return {
    hp: 20,
    maxHp: 30,
    xp: 0,
    level: 1,
    xpForNext: 100,
    hotbar: [null, null, null, null, null, null, null, null, null],
    inventory: [],
    weapon: null,
    fx: [],
    pingMs: 40,
    connected: true,
    reconnecting: false,
    reconnectAttempts: 0,
    downed: false,
    dead: false,
    party: null,
    craftTableNearby: false,
    stashNearby: false,
    stash: null,
    lastToast: null,
    toasts: [],
    seed: null,
    floor: 1,
    boss: null,
    ...overrides,
  };
}

/** Neutral fps/bodyPos/chat/contacts args for tests that don't care about those fields. */
const FPS = 60;
const BODY_POS = { x: 0, y: 0, z: 0 };
const CHAT_MODEL: ChatPanelModel = { tabs: [], lines: [] };
const CONTACTS: never[] = [];
const COMPASS = 0;
const STAIRWAY = null;

function snapshotOf(src: HudSnapshotSource, armedThrowableSlot = null as number | null, fps = FPS, bodyPos = BODY_POS) {
  return buildHudSnapshot(src, armedThrowableSlot, null, null, fps, bodyPos, CHAT_MODEL, CONTACTS, COMPASS, STAIRWAY);
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
    const snap = buildHudSnapshot(source(), null, null, null, FPS, BODY_POS, chatModel, contacts, COMPASS, STAIRWAY);
    expect(snap.chatModel).toBe(chatModel);
    expect(snap.contacts).toEqual(contacts);
  });

  it("passes through armedThrowableSlot, interactionPrompt, and touch unchanged", () => {
    const prompt = { key: "E", label: "interact" };
    const touch = { stick: null, buttons: { attack: false, jump: false, interact: false } };
    const snap = buildHudSnapshot(source(), 3, prompt, touch, FPS, BODY_POS, CHAT_MODEL, CONTACTS, COMPASS, STAIRWAY);
    expect(snap.armedThrowableSlot).toBe(3);
    expect(snap.interactionPrompt).toBe(prompt);
    expect(snap.touch).toBe(touch);
  });

  it("passes the stairway tick straight through for the compass widget (LANE W)", () => {
    const tick = { screenBearingDeg: 135, near: true };
    const snap = buildHudSnapshot(source(), null, null, null, FPS, BODY_POS, CHAT_MODEL, CONTACTS, COMPASS, tick);
    expect(snap.stairway).toBe(tick);
    expect(snapshotOf(source()).stairway).toBeNull();
  });

  it("passes fps straight through for the top-right indicator's own smoothing", () => {
    const snap = snapshotOf(source(), null, 47);
    expect(snap.fps).toBe(47);
  });

  it("rounds the predicted body position into whole-tile x/y and one-decimal z", () => {
    const snap = snapshotOf(source(), null, FPS, { x: 128.4, y: -63.6, z: 2.34 });
    expect(snap.coords).toEqual({ x: 128, y: -64, z: 2.3 });
  });

  it("builds one inventory row per InvStack, tagging its hotbar-bound slot (or null when unbound)", () => {
    const hotbar = ["sword", null, null, null, null, null, null, null, null];
    const inventory = [
      { item: "sword", qty: 1 },
      { item: "rag", qty: 6 },
    ];
    const snap = snapshotOf(source({ hotbar, inventory }));
    expect(snap.inventory).toEqual([
      { itemId: "sword", name: "Rusty Sword", qty: 1, category: "weapons", boundSlot: 0, flavor: expect.any(String) },
      { itemId: "rag", name: "Rag", qty: 6, category: "materials", boundSlot: null, flavor: expect.any(String) },
    ]);
  });

  it("builds the craft window's have/need rows from live inventory, gated on nearby", () => {
    const snap = snapshotOf(source({ inventory: [{ item: "rag", qty: 6 }], craftTableNearby: true }));
    expect(snap.craft.nearby).toBe(true);
    const bandage = snap.craft.recipes.find((r) => r.recipeId === "bandage");
    expect(bandage?.craftable).toBe(true);
    expect(snap.craft.recipes.length).toBeGreaterThan(0);
  });

  it("reports the craft window as not nearby when no table is in range", () => {
    const snap = snapshotOf(source({ craftTableNearby: false }));
    expect(snap.craft.nearby).toBe(false);
  });

  it("builds the stash window's two columns from inventory and the live stash", () => {
    const inventory = [{ item: "sword", qty: 1 }];
    const stash = [{ item: "bandage", qty: 2 }];
    const snap = snapshotOf(source({ inventory, stash, stashNearby: true }));
    expect(snap.stash).toEqual({
      nearby: true,
      inventory: [{ index: 0, itemId: "sword", name: "Rusty Sword", qty: 1 }],
      entries: [{ index: 0, itemId: "bandage", name: "Bandage", qty: 2 }],
    });
  });

  it("treats a null stash (no server event yet) as an empty entries column", () => {
    const snap = snapshotOf(source({ stash: null, stashNearby: true }));
    expect(snap.stash.entries).toEqual([]);
  });

  it("passes the latest toast straight through", () => {
    const toast = { msg: "Crafted bandage", until: 12345 };
    const snap = snapshotOf(source({ lastToast: toast }));
    expect(snap.lastToast).toBe(toast);
  });

  it("passes the full toast queue and seed straight through", () => {
    const toasts = [{ msg: "Missing rag", until: 999 }];
    const snap = snapshotOf(source({ toasts, seed: "e2e-world" }));
    expect(snap.toasts).toEqual(toasts);
    expect(snap.seed).toBe("e2e-world");
  });

  it("defaults seed to null when the connection carries none", () => {
    expect(snapshotOf(source()).seed).toBeNull();
  });

  it("maps xp/level/xpForNext straight through to the xp-bar widget's data", () => {
    const snap = snapshotOf(source({ xp: 220, level: 3, xpForNext: 80 }));
    expect(snap.xp).toEqual({ xp: 220, level: 3, xpForNext: 80 });
  });
});
