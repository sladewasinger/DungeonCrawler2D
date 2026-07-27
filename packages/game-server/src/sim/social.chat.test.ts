import { TICK_RATE } from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { doChat, doParty } from "./social/social.js";
import { doModeration } from "./moderation.js";
import { makeSocialSlot, makeSocialState } from "./social/social.testSupport.js";
import type { PlayerSlot, SimState } from "./state/state.js";

describe("social chat", () => {
  let sim: SimState;
  let a: PlayerSlot;
  let b: PlayerSlot;

  beforeEach(() => {
    sim = makeSocialState();
    a = makeSocialSlot("A", 10, 10);
    b = makeSocialSlot("B", 12, 10);
    sim.players.set(a.entity.id, a);
    sim.players.set(b.entity.id, b);
  });

  it("applies moderation controls authoritatively", () => {
    doModeration({ sim, slot: b, op: "mute", targetId: a.entity.id });
    doChat({ sim, slot: a, channel: "global", text: "muted" });
    expect(b.outbox.some((event) => event.t === "chat" && event.text === "muted")).toBe(false);
    doModeration({ sim, slot: b, op: "unmute", targetId: a.entity.id });
    doChat({ sim, slot: a, channel: "global", text: "heard" });
    expect(b.outbox.some((event) => event.t === "chat" && event.text === "heard")).toBe(true);
    doModeration({ sim, slot: b, op: "block", targetId: a.entity.id });
    doParty({ sim, slot: a, op: "invite", target: b.entity.id });
    expect(sim.invites.has(b.entity.id)).toBe(false);
    doModeration({ sim, slot: b, op: "report", targetId: a.entity.id, reason: "chat abuse" });
    expect(sim.moderationReports.at(-1)).toMatchObject({ reason: "chat abuse" });
  });

  it("party and local chat use their proper delivery channels", () => {
    doParty({ sim, slot: a, op: "invite", target: b.entity.id });
    doParty({ sim, slot: b, op: "accept" });
    doChat({ sim, slot: a, channel: "party", text: "descend at dawn" });
    expect(b.outbox.some((e) => e.t === "chat" && e.channel === "party")).toBe(true);
    doChat({ sim, slot: a, channel: "local", text: "anyone here?" });
    expect(sim.worldEvents.at(-1)).toMatchObject({ ev: { t: "chat", channel: "local" } });
  });

  it("delivers global and direct messages to allowed recipients", () => {
    doChat({ sim, slot: a, channel: "global", text: "hello floor" });
    expect(b.outbox.some((e) => e.t === "chat" && e.channel === "global")).toBe(true);
    doChat({ sim, slot: a, channel: "dm", text: "psst", target: "B" });
    expect(a.outbox.some((e) => e.t === "chat" && e.channel === "system")).toBe(true);
    a.stored.contacts.push("B");
    doChat({ sim, slot: a, channel: "dm", text: "hi B", target: "B" });
    expect(b.outbox.some((e) => e.t === "chat" && e.target === "A")).toBe(true);
  });

  it("rejects ambiguous or self direct-message targets", () => {
    a.stored.contacts.push("b");
    const b2 = makeSocialSlot("B", 12, 10);
    sim.players.set(b2.entity.id, b2);
    doChat({ sim, slot: a, channel: "dm", text: "hi", target: "b" });
    expect(a.outbox.some((e) => e.t === "chat" && e.text.includes("Multiple"))).toBe(true);
    doChat({ sim, slot: a, channel: "dm", text: "hi me", target: "A" });
    expect(a.outbox.some((e) => e.t === "chat" && e.text.includes("yourself"))).toBe(true);
  });

  it("rate limits chat and keeps delivery working for other players", () => {
    for (let index = 0; index < 5; index++) doChat({ sim, slot: a, channel: "global", text: `sent ${index}` });
    doChat({ sim, slot: a, channel: "global", text: "rejected" });
    expect(a.outbox.some((e) => e.t === "chat" && e.channel === "system")).toBe(true);
    a.outbox.length = 0;
    sim.tickCount = 3 * TICK_RATE;
    doChat({ sim, slot: b, channel: "global", text: "still visible" });
    expect(a.outbox.some((e) => e.t === "chat" && e.text === "still visible")).toBe(true);
  });
});
