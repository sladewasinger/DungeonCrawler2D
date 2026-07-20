import { AOI_RADIUS } from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { GameSim } from "../index.js";
import { eventsOf, makeSim, teleport } from "./support.js";

/**
 * Epic 7.9 wire-level regressions, driven through the real
 * queueAction/step protocol path (not sim/social.ts directly — see
 * ../social.test.ts for that module-level coverage): global fan-out
 * bypasses AOI, DM gating denies non-contacts and self-targets, and the
 * shared chat rate limit rejects a 6th message regardless of channel.
 */

describe("GameSim: chat channels (Epic 7.9)", () => {
  let sim: GameSim;

  beforeEach(() => {
    sim = makeSim();
  });

  it("global reaches a player far outside local AOI; local does not", () => {
    const a = sim.addPlayer("A", "client-a");
    const b = sim.addPlayer("B", "client-b");
    teleport(sim.getPlayerEntity(b.playerId)!, a.spawn.x + AOI_RADIUS * 3, a.spawn.y, sim);

    sim.queueAction(a.playerId, { type: "chat", channel: "local", text: "can't hear this" });
    let snaps = sim.step();
    expect(eventsOf(snaps, b.playerId).some((e) => e.t === "chat" && e.channel === "local")).toBe(false);

    sim.queueAction(a.playerId, { type: "chat", channel: "global", text: "hello floor" });
    snaps = sim.step();
    expect(
      eventsOf(snaps, b.playerId).some(
        (e) => e.t === "chat" && e.channel === "global" && e.text === "hello floor",
      ),
    ).toBe(true);
  });

  it("dm to a non-contact is denied with a system line; nothing is delivered", () => {
    const a = sim.addPlayer("A", "client-a");
    const b = sim.addPlayer("B", "client-b");

    sim.queueAction(a.playerId, { type: "chat", channel: "dm", text: "psst", target: "B" });
    const snaps = sim.step();
    expect(eventsOf(snaps, b.playerId).some((e) => e.t === "chat" && e.channel === "dm")).toBe(false);
    expect(eventsOf(snaps, a.playerId).some((e) => e.t === "chat" && e.channel === "system")).toBe(true);
  });

  it("malformed dm intents are rejected: self-target and an unknown recipient", () => {
    const a = sim.addPlayer("A", "client-a");

    sim.queueAction(a.playerId, { type: "chat", channel: "dm", text: "hi me", target: "A" });
    let snaps = sim.step();
    expect(
      eventsOf(snaps, a.playerId).some(
        (e) => e.t === "chat" && e.channel === "system" && e.text.includes("yourself"),
      ),
    ).toBe(true);

    sim.queueAction(a.playerId, { type: "chat", channel: "dm", text: "?", target: "Nobody" });
    snaps = sim.step();
    expect(eventsOf(snaps, a.playerId).some((e) => e.t === "chat" && e.channel === "system")).toBe(true);
  });

  it("rate limit boundary: the 5th chat of any channel is fine, the 6th is denied", () => {
    const a = sim.addPlayer("A", "client-a");
    // Flush the announcer's own join system line (Epic 7.13) before
    // asserting on the chat rate limit's system-line output below.
    sim.step();
    for (let i = 0; i < 5; i++) {
      sim.queueAction(a.playerId, { type: "chat", channel: "local", text: `msg${i}` });
    }
    let snaps = sim.step();
    expect(eventsOf(snaps, a.playerId).filter((e) => e.t === "chat" && e.channel === "system")).toHaveLength(0);

    sim.queueAction(a.playerId, { type: "chat", channel: "local", text: "one too many" });
    snaps = sim.step();
    expect(eventsOf(snaps, a.playerId).some((e) => e.t === "chat" && e.channel === "system")).toBe(true);
  });
});
