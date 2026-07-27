import { describe, expect, it } from "vitest";
import type { ChatPanelModel } from "../../../ui/chat/controller.js";
import { buildHudSnapshot, type HudSnapshotSource } from "./hudSnapshot.js";

export function source(overrides: Partial<HudSnapshotSource> = {}): HudSnapshotSource {
  return {
    playerId: "self",
    hp: 20,
    maxHp: 30,
    stamina: 100,
    maxStamina: 100,
    blocking: false,
    staminaExhausted: false,
    xp: 0,
    level: 1,
    xpForNext: 100,
    hotbar: [null, null, null, null, null, null, null, null, null],
    inventory: [],
    weapon: null,
    fx: [],
    statusEffects: [],
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

interface SnapshotTestOptions {
  readonly selectedSlot?: number | null;
  readonly fps?: number;
  readonly bodyPos?: typeof BODY_POS;
}

export function snapshotOf(src: HudSnapshotSource, options: SnapshotTestOptions = {}) {
  const { selectedSlot = null, fps = FPS, bodyPos = BODY_POS } = options;
  return buildHudSnapshot({
    src, selectedHotbarSlot: selectedSlot, armedThrowableSlot: null, interactionPrompt: null,
    touch: null, fps, bodyPos, chatModel: CHAT_MODEL, contacts: CONTACTS,
    compassBearingDeg: COMPASS, stairway: STAIRWAY,
  });
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

  it("highlights the explicitly selected hotbar slot", () => {
    const hotbar = [null, "sword", null, null, null, null, null, null, null];
    const snap = snapshotOf(source({ hotbar, weapon: "sword" }), { selectedSlot: 1 });
    expect(snap.selectedSlot).toBe(1);
  });

  it("publishes authoritative stamina/blocking and matching action help", () => {
    const snap = snapshotOf(source({ hotbar: ["bandage", null, null, null, null, null, null, null, null], weapon: "sword", stamina: 42, blocking: true }), { selectedSlot: 0 });
    expect(snap.stamina).toEqual({ stamina: 42, maxStamina: 100, blocking: true });
    expect(snap.actionHints.map(({ action }) => action)).toEqual(["use", "attack", "block"]);
  });

  it("does not advertise blocking while stamina is exhausted", () =>
    expect(snapshotOf(source({ weapon: "sword", stamina: 2, staminaExhausted: true })).actionHints.map(({ action }) => action)).toEqual(["attack"]));

  it("selects -1 when unarmed", () => {
    const snap = snapshotOf(source({ weapon: null }));
    expect(snap.selectedSlot).toBe(-1);
  });

  it("resolves buff kind/duration from content, defaulting unknown ids to a debuff", () => {
    const snap = snapshotOf(source({
      fx: ["on-fire", "regenerating", "made-up"],
      statusEffects: [{
        id: "on-fire",
        remainingSeconds: 2.25,
        durationSeconds: 5,
      }],
    }));
    expect(snap.buffs).toEqual([{
      statusId: "on-fire",
      kind: "debuff",
      remainingSec: 2.25,
      durationSec: 5,
    }]);
    const fallback = snapshotOf(source({ fx: ["on-fire", "regenerating", "made-up"] }));
    expect(fallback.buffs).toContainEqual({ statusId: "on-fire", kind: "debuff", remainingSec: 5, durationSec: 5 });
    expect(fallback.buffs).toContainEqual({
      statusId: "regenerating",
      kind: "buff",
      remainingSec: 20,
      durationSec: 20,
    });
    expect(fallback.buffs).toContainEqual({ statusId: "made-up", kind: "debuff", remainingSec: 1, durationSec: 1 });
  });

  it("passes the chat model and contacts straight through (owned by ui/chat/controller.ts)", () => {
    const chatModel: ChatPanelModel = {
      tabs: [{ id: "global", active: true, unread: false, dim: false }],
      lines: [{ channel: "global", author: "server", text: "welcome" }],
    };
    const contacts = [{ name: "Wren", online: true }];
    const snap = buildHudSnapshot({ src: source(), selectedHotbarSlot: null, armedThrowableSlot: null, interactionPrompt: null, touch: null, fps: FPS, bodyPos: BODY_POS, chatModel, contacts, compassBearingDeg: COMPASS, stairway: STAIRWAY });
    expect(snap.chatModel).toBe(chatModel);
    expect(snap.contacts).toEqual(contacts);
  });

  it("passes through armedThrowableSlot, interactionPrompt, and touch unchanged", () => {
    const prompt = { key: "E", label: "interact" };
    const touch = { stick: null, buttons: { attack: false, jump: false, interact: false } };
    const snap = buildHudSnapshot({ src: source(), selectedHotbarSlot: 3, armedThrowableSlot: 3, interactionPrompt: prompt, touch, fps: FPS, bodyPos: BODY_POS, chatModel: CHAT_MODEL, contacts: CONTACTS, compassBearingDeg: COMPASS, stairway: STAIRWAY });
    expect(snap.armedThrowableSlot).toBe(3);
    expect(snap.interactionPrompt).toBe(prompt);
    expect(snap.touch).toBe(touch);
  });

  it("passes the stairway tick straight through for the compass widget (LANE W)", () => {
    const tick = { screenBearingDeg: 135, near: true };
    const snap = buildHudSnapshot({ src: source(), selectedHotbarSlot: null, armedThrowableSlot: null, interactionPrompt: null, touch: null, fps: FPS, bodyPos: BODY_POS, chatModel: CHAT_MODEL, contacts: CONTACTS, compassBearingDeg: COMPASS, stairway: tick });
    expect(snap.stairway).toBe(tick);
    expect(snapshotOf(source()).stairway).toBeNull();
  });

  it("passes fps straight through for the top-right indicator's own smoothing", () => {
    const snap = snapshotOf(source(), { fps: 47 });
    expect(snap.fps).toBe(47);
  });

  it("rounds the predicted body position into whole-tile x/y and one-decimal z", () => {
    const snap = snapshotOf(source(), { bodyPos: { x: 128.4, y: -63.6, z: 2.34 } });
    expect(snap.coords).toEqual({ x: 128, y: -64, z: 2.3 });
  });

});
