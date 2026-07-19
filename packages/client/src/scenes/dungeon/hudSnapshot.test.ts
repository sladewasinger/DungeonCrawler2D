import { describe, expect, it } from "vitest";
import { buildHudSnapshot, type HudSnapshotSource } from "./hudSnapshot.js";

function source(overrides: Partial<HudSnapshotSource> = {}): HudSnapshotSource {
  return {
    hp: 20,
    maxHp: 30,
    hotbar: [null, null, null, null, null, null, null, null, null],
    inventory: [],
    weapon: null,
    fx: [],
    chatLog: [],
    hasParty: false,
    pingMs: 40,
    connected: true,
    reconnecting: false,
    downed: false,
    ...overrides,
  };
}

describe("buildHudSnapshot", () => {
  it("maps health/ping/connection straight through", () => {
    const snap = buildHudSnapshot(source({ hp: 5, maxHp: 30, pingMs: 99 }), null, null, null);
    expect(snap.health).toEqual({ hp: 5, maxHp: 30 });
    expect(snap.pingMs).toBe(99);
    expect(snap.connected).toBe(true);
  });

  it("fills hotbar counts from inventory stacks", () => {
    const hotbar = ["sword", null, "bandage", null, null, null, null, null, null];
    const inventory = [{ item: "sword", qty: 1 }, { item: "bandage", qty: 3 }];
    const snap = buildHudSnapshot(source({ hotbar, inventory }), null, null, null);
    expect(snap.hotbar[0]).toEqual({ itemId: "sword", count: 1 });
    expect(snap.hotbar[2]).toEqual({ itemId: "bandage", count: 3 });
    expect(snap.hotbar[1]).toEqual({ itemId: null, count: 0 });
  });

  it("highlights the hotbar slot holding the equipped weapon", () => {
    const hotbar = [null, "sword", null, null, null, null, null, null, null];
    const snap = buildHudSnapshot(source({ hotbar, weapon: "sword" }), null, null, null);
    expect(snap.selectedSlot).toBe(1);
  });

  it("selects -1 when unarmed", () => {
    const snap = buildHudSnapshot(source({ weapon: null }), null, null, null);
    expect(snap.selectedSlot).toBe(-1);
  });

  it("resolves buff kind/duration from content, defaulting unknown ids to a debuff", () => {
    const snap = buildHudSnapshot(source({ fx: ["on-fire", "regenerating", "made-up"] }), null, null, null);
    expect(snap.buffs).toContainEqual({ statusId: "on-fire", kind: "debuff", remainingSec: 5, durationSec: 5 });
    expect(snap.buffs).toContainEqual({
      statusId: "regenerating",
      kind: "buff",
      remainingSec: 20,
      durationSec: 20,
    });
    expect(snap.buffs).toContainEqual({ statusId: "made-up", kind: "debuff", remainingSec: 1, durationSec: 1 });
  });

  it("folds system chat lines into the local channel", () => {
    const snap = buildHudSnapshot(
      source({ chatLog: [{ channel: "system", name: "server", text: "welcome" }] }),
      null,
      null,
      null,
    );
    expect(snap.chat).toEqual([{ channel: "local", author: "server", text: "welcome" }]);
  });

  it("picks party as the active channel once partied", () => {
    const snap = buildHudSnapshot(source({ hasParty: true }), null, null, null);
    expect(snap.activeChatChannel).toBe("party");
  });

  it("passes through armedThrowableSlot, interactionPrompt, and touch unchanged", () => {
    const prompt = { key: "E", label: "interact" };
    const touch = { stick: null, buttons: { attack: false, jump: false, interact: false } };
    const snap = buildHudSnapshot(source(), 3, prompt, touch);
    expect(snap.armedThrowableSlot).toBe(3);
    expect(snap.interactionPrompt).toBe(prompt);
    expect(snap.touch).toBe(touch);
  });
});
