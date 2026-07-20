import { LEVEL, TICK_RATE, World } from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { GameSim } from "../index.js";
import { PlayerStore } from "../../store.js";
import { content, SEED, eventsOf, makeSim, stepN, teleport } from "./support.js";

/**
 * Epic 7.10 wire-level regressions, driven through the real
 * queueAction/step protocol path (see ../contacts.test.ts for the
 * module-level fistbump/contacts coverage): mutual-contact persistence
 * across a server restart, DMs unlocking once contacts, offer expiry,
 * the reciprocal-offer race, and a rejected self-target.
 */

function nearbyPair(sim: GameSim): { aId: string; bId: string } {
  const a = sim.addPlayer("A", "client-a");
  const b = sim.addPlayer("B", "client-b");
  teleport(sim.getPlayerEntity(b.playerId)!, sim.getPlayerEntity(a.playerId)!.body.x + 1, sim.getPlayerEntity(a.playerId)!.body.y, sim);
  return { aId: a.playerId, bId: b.playerId };
}

describe("GameSim: fistbump contacts (Epic 7.10)", () => {
  it("a mutual fistbump seals a contact that survives a restart, then unlocks DMs", () => {
    const store = new PlayerStore(null);
    const sim1 = new GameSim(new World(SEED, 1, LEVEL.Sandbox), content, store, 1234, { testFixtures: true });
    const { aId, bId } = nearbyPair(sim1);

    sim1.queueAction(aId, { type: "fistbump", targetId: bId });
    sim1.queueAction(bId, { type: "fistbump", targetId: aId });
    const sealSnaps = sim1.step();
    expect(eventsOf(sealSnaps, aId).some((e) => e.t === "contactsUpdated")).toBe(true);
    expect(eventsOf(sealSnaps, bId).some((e) => e.t === "contactsUpdated")).toBe(true);

    sim1.queueAction(aId, { type: "chat", channel: "dm", text: "yo", target: "B" });
    const dmSnaps = sim1.step();
    expect(eventsOf(dmSnaps, bId).some((e) => e.t === "chat" && e.channel === "dm" && e.text === "yo")).toBe(
      true,
    );

    // Restart: a fresh GameSim (new in-memory players) over the SAME
    // store still knows A and B are contacts, so a DM goes straight through.
    const sim2 = new GameSim(new World(SEED, 1, LEVEL.Sandbox), content, store, 99, { testFixtures: true });
    const a2 = sim2.addPlayer("A", "client-a");
    const b2 = sim2.addPlayer("B", "client-b");
    sim2.queueAction(a2.playerId, { type: "chat", channel: "dm", text: "still contacts?", target: "B" });
    const snaps2 = sim2.step();
    expect(eventsOf(snaps2, b2.playerId).some((e) => e.t === "chat" && e.channel === "dm")).toBe(true);
  });

  describe("with a fresh sim", () => {
    let sim: GameSim;

    beforeEach(() => {
      sim = makeSim();
    });

    it("simultaneous reciprocal offers in the same tick seal exactly one contact, no dupes", () => {
      const { aId, bId } = nearbyPair(sim);
      sim.step(); // drain each join's own contactsUpdated (empty list) first
      sim.queueAction(aId, { type: "fistbump", targetId: bId });
      sim.queueAction(bId, { type: "fistbump", targetId: aId });
      const snaps = sim.step();

      const aEvents = eventsOf(snaps, aId).filter((e) => e.t === "contactsUpdated");
      const bEvents = eventsOf(snaps, bId).filter((e) => e.t === "contactsUpdated");
      expect(aEvents).toHaveLength(1); // exactly one seal, no duplicate contact entries
      expect(bEvents).toHaveLength(1);
      expect(aEvents[0]!.t === "contactsUpdated" ? aEvents[0]!.contacts : []).toEqual([
        { name: "B", online: true },
      ]);
      expect(bEvents[0]!.t === "contactsUpdated" ? bEvents[0]!.contacts : []).toEqual([
        { name: "A", online: true },
      ]);
    });

    it("an offer past its 10s TTL no longer auto-seals a late reciprocal hold", () => {
      const { aId, bId } = nearbyPair(sim);
      sim.queueAction(aId, { type: "fistbump", targetId: bId });
      sim.step();

      stepN(sim, 10 * TICK_RATE + 1); // past the offer's 10s window

      sim.queueAction(bId, { type: "fistbump", targetId: aId });
      const snaps = sim.step();
      expect(eventsOf(snaps, aId).some((e) => e.t === "contactsUpdated")).toBe(false);
      expect(eventsOf(snaps, bId).some((e) => e.t === "contactsUpdated")).toBe(false);
    });

    it("a self-targeted fistbump is a rejected no-op", () => {
      const a = sim.addPlayer("A", "client-a");
      sim.step(); // drain the join's own contactsUpdated first
      sim.queueAction(a.playerId, { type: "fistbump", targetId: a.playerId });
      const snaps = sim.step();
      expect(eventsOf(snaps, a.playerId).some((e) => e.t === "contactsUpdated")).toBe(false);
    });
  });
});
