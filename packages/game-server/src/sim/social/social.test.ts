import { beforeEach, describe, expect, it } from "vitest";
import { doParty, expireInvites, leaveParty } from "./social.js";
import { makeSocialSlot, makeSocialState } from "./social.testSupport.js";
import type { PlayerSlot, SimState } from "../state/state.js";

/**
 * Unit tests for the social module in isolation (no ws/GameSim layer
 * yet): party invite/accept/leave consent + proximity, chat fan-out,
 * and invite expiry.
 */

describe("social", () => {
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

  it("drops an invite when the target is out of range", () => {
    b.entity.body.x = a.entity.body.x + 500;
    doParty({ sim, slot: a, op: "invite", target: b.entity.id });
    expect(sim.invites.has(b.entity.id)).toBe(false);
    expect(b.outbox.some((e) => e.t === "invite")).toBe(false);
  });

  it("invite/accept forms a party; leave at 1 member disbands it", () => {
    doParty({ sim, slot: a, op: "invite", target: b.entity.id });
    expect(sim.invites.get(b.entity.id)?.from).toBe(a.entity.id);
    expect(b.outbox.some((e) => e.t === "invite" && e.from === a.entity.id)).toBe(true);

    doParty({ sim, slot: b, op: "accept" });
    expect(a.partyId).not.toBeNull();
    expect(a.partyId).toBe(b.partyId);
    expect(sim.parties.get(a.partyId!)?.members.has(b.entity.id)).toBe(true);
    expect(sim.invites.has(b.entity.id)).toBe(false);

    doParty({ sim, slot: b, op: "leave" });
    expect(b.partyId).toBeNull();
    expect(b.entity.partyId).toBeUndefined();
    // Sole remaining member is also released and the party record is gone.
    expect(a.partyId).toBeNull();
    expect(sim.parties.size).toBe(0);
    expect(a.outbox.some((e) => e.t === "toast" && e.msg === "Party disbanded")).toBe(true);
  });

  it("accept without a pending (or expired) invite is a no-op", () => {
    doParty({ sim, slot: b, op: "accept" });
    expect(b.partyId).toBeNull();
  });

  it("declining removes the invite and tells the inviter", () => {
    doParty({ sim, slot: a, op: "invite", target: b.entity.id });
    doParty({ sim, slot: b, op: "decline" });
    expect(sim.invites.has(b.entity.id)).toBe(false);
    expect(a.outbox).toContainEqual({
      t: "toast",
      msg: "B declined the party invite",
    });
    doParty({ sim, slot: b, op: "accept" });
    expect(b.partyId).toBeNull();
  });

  it("lets an inviter cancel an outstanding invitation", () => {
    doParty({ sim, slot: a, op: "invite", target: b.entity.id });
    doParty({ sim, slot: a, op: "cancel", target: b.entity.id });
    expect(sim.invites.has(b.entity.id)).toBe(false);
    expect(a.outbox).toContainEqual({
      t: "partyInviteState",
      direction: "outgoing",
      action: "removed",
      id: b.entity.id,
      name: "B",
    });
    expect(b.outbox).toContainEqual({
      t: "partyInviteState",
      direction: "incoming",
      action: "removed",
      id: a.entity.id,
      name: "A",
    });
  });

  it("assigns a leader, restricts invites, and lets the leader kick", () => {
    const c = makeSocialSlot("C", 11, 10);
    sim.players.set(c.entity.id, c);
    doParty({ sim, slot: a, op: "invite", target: b.entity.id });
    doParty({ sim, slot: b, op: "accept" });
    const party = sim.parties.get(a.partyId!)!;
    expect(party.leaderId).toBe(a.entity.id);

    doParty({ sim, slot: b, op: "invite", target: c.entity.id });
    expect(sim.invites.has(c.entity.id)).toBe(false);
    expect(b.outbox).toContainEqual({ t: "toast", msg: "Only the party leader can invite" });

    doParty({ sim, slot: a, op: "kick", target: b.entity.id });
    expect(b.partyId).toBeNull();
    expect(a.partyId).toBeNull();
    expect(sim.parties.size).toBe(0);
  });

  it("expireInvites drops stale invites but keeps live ones", () => {
    doParty({ sim, slot: a, op: "invite", target: b.entity.id });
    const invite = sim.invites.get(b.entity.id)!;
    sim.tickCount = invite.expiresAt + 1;
    expireInvites(sim);
    expect(sim.invites.has(b.entity.id)).toBe(false);
  });

  it("leaveParty on a partyless slot is a no-op", () => {
    expect(() => leaveParty(sim, a)).not.toThrow();
    expect(a.partyId).toBeNull();
  });

});
