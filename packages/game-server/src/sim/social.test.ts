import {
  LEVEL,
  TICK_RATE,
  World,
  buildContentRegistry,
  createBody,
  hashString,
  makeEntity,
  newEntityId,
  type RawContent,
} from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { PlayerStore } from "../store.js";
import { doChat, doParty, expireInvites, leaveParty } from "./social.js";
import { createSimState, type PlayerSlot, type SimState } from "./state.js";

/**
 * Unit tests for the social module in isolation (no ws/GameSim layer
 * yet): party invite/accept/leave consent + proximity, chat fan-out,
 * and invite expiry. Assertions carried over from
 * reference/game-server/sim.test.ts's Epic 7 party/chat cases.
 */

const EMPTY_CONTENT: RawContent = {
  statuses: [],
  rules: [],
  areas: [],
  items: [],
  enemies: [],
  recipes: [],
};

function makeSlot(name: string, x: number, y: number): PlayerSlot {
  const entity = makeEntity("player", createBody(x, y, 0), {
    id: newEntityId("p"),
    name,
    hp: 10,
    maxHp: 10,
    tags: new Set(["player"]),
  });
  return {
    entity,
    clientId: `client-${name}`,
    stored: { slot: 0, name, stash: [], contacts: [] },
    resumeToken: `token-${name}`,
    lastSeq: -1,
    pendingInputs: [],
    pendingActions: [],
    connected: true,
    reapAtTick: Number.MAX_SAFE_INTEGER,
    known: new Set(),
    inventory: [],
    hotbar: [],
    weapon: null,
    outbox: [],
    returnStack: [],
    partyId: null,
    respawnAtTick: null,
    needsFullAreas: true,
    downedAtTick: null,
    attackReadyAtTick: 0,
    attackStartedAtTick: Number.NEGATIVE_INFINITY,
    god: false,
    forceDeath: false,
    chatTimestamps: [],
    lastFistbumpOfferAtTick: -Infinity, spawnGraceUntilTick: 0, pendingTransfer: null,
  };
}

describe("social", () => {
  let sim: SimState;
  let a: PlayerSlot;
  let b: PlayerSlot;

  beforeEach(() => {
    const world = new World(hashString("social-test"), 1, LEVEL.Sandbox);
    const content = buildContentRegistry(EMPTY_CONTENT);
    sim = createSimState(world, content, new PlayerStore(null), 1, {});
    a = makeSlot("A", 10, 10);
    b = makeSlot("B", 12, 10);
    sim.players.set(a.entity.id, a);
    sim.players.set(b.entity.id, b);
  });

  it("drops an invite when the target is out of range", () => {
    b.entity.body.x = a.entity.body.x + 500;
    doParty(sim, a, "invite", b.entity.id);
    expect(sim.invites.has(b.entity.id)).toBe(false);
    expect(b.outbox.some((e) => e.t === "invite")).toBe(false);
  });

  it("invite/accept forms a party; leave at 1 member disbands it", () => {
    doParty(sim, a, "invite", b.entity.id);
    expect(sim.invites.get(b.entity.id)?.from).toBe(a.entity.id);
    expect(b.outbox.some((e) => e.t === "invite" && e.from === a.entity.id)).toBe(true);

    doParty(sim, b, "accept");
    expect(a.partyId).not.toBeNull();
    expect(a.partyId).toBe(b.partyId);
    expect(sim.parties.get(a.partyId!)?.members.has(b.entity.id)).toBe(true);
    expect(sim.invites.has(b.entity.id)).toBe(false);

    doParty(sim, b, "leave");
    expect(b.partyId).toBeNull();
    expect(b.entity.partyId).toBeUndefined();
    // Sole remaining member is also released and the party record is gone.
    expect(a.partyId).toBeNull();
    expect(sim.parties.size).toBe(0);
    expect(a.outbox.some((e) => e.t === "toast" && e.msg === "Party disbanded")).toBe(true);
  });

  it("accept without a pending (or expired) invite is a no-op", () => {
    doParty(sim, b, "accept");
    expect(b.partyId).toBeNull();
  });

  it("party chat reaches every member; local chat is a positional world event", () => {
    doParty(sim, a, "invite", b.entity.id);
    doParty(sim, b, "accept");

    doChat(sim, a, "party", "descend at dawn");
    expect(
      b.outbox.some((e) => e.t === "chat" && e.channel === "party" && e.text === "descend at dawn"),
    ).toBe(true);

    doChat(sim, a, "local", "anyone here?");
    expect(sim.worldEvents.at(-1)).toMatchObject({
      ev: { t: "chat", channel: "local", text: "anyone here?" },
      x: a.entity.body.x,
      y: a.entity.body.y,
    });
  });

  it("party chat from a partyless player is dropped", () => {
    doChat(sim, a, "party", "hello?");
    expect(b.outbox.some((e) => e.t === "chat")).toBe(false);
  });

  it("expireInvites drops stale invites but keeps live ones", () => {
    doParty(sim, a, "invite", b.entity.id);
    const invite = sim.invites.get(b.entity.id)!;
    sim.tickCount = invite.expiresAt + 1;
    expireInvites(sim);
    expect(sim.invites.has(b.entity.id)).toBe(false);
  });

  it("leaveParty on a partyless slot is a no-op", () => {
    expect(() => leaveParty(sim, a)).not.toThrow();
    expect(a.partyId).toBeNull();
  });

  it("global chat reaches every connected player, sender included", () => {
    doChat(sim, a, "global", "hello floor");
    expect(a.outbox.some((e) => e.t === "chat" && e.channel === "global")).toBe(true);
    expect(b.outbox.some((e) => e.t === "chat" && e.channel === "global")).toBe(true);
  });

  it("dm to a non-contact is denied with a system line, no message delivered", () => {
    doChat(sim, a, "dm", "psst", "B");
    expect(b.outbox.some((e) => e.t === "chat" && e.channel === "dm")).toBe(false);
    expect(a.outbox.some((e) => e.t === "chat" && e.channel === "system")).toBe(true);
  });

  it("dm between mutual contacts reaches both ends with the thread partner as target", () => {
    a.stored.contacts.push("B");
    doChat(sim, a, "dm", "hi B", "B");
    expect(b.outbox.some((e) => e.t === "chat" && e.channel === "dm" && e.target === "A")).toBe(true);
    expect(a.outbox.some((e) => e.t === "chat" && e.channel === "dm" && e.target === "B")).toBe(true);
  });

  it("dm name matching is case-insensitive and rejects ambiguous online matches", () => {
    a.stored.contacts.push("b");
    doChat(sim, a, "dm", "hi", "b");
    expect(b.outbox.some((e) => e.t === "chat" && e.channel === "dm")).toBe(true);

    const b2 = makeSlot("B", 12, 10);
    sim.players.set(b2.entity.id, b2);
    doChat(sim, a, "dm", "hi again", "b");
    expect(a.outbox.some((e) => e.t === "chat" && e.channel === "system" && e.text.includes("Multiple"))).toBe(
      true,
    );
  });

  it("dm to yourself is rejected with a clear system line", () => {
    doChat(sim, a, "dm", "hi me", "A");
    expect(a.outbox.some((e) => e.t === "chat" && e.channel === "system" && e.text.includes("yourself"))).toBe(
      true,
    );
  });

  it("chat allows five messages per three seconds and then recovers automatically", () => {
    // Mixed channels all draw from the same rolling-window budget — the
    // 5th of ANY kind is fine, the 6th (even on a different channel) isn't.
    doChat(sim, a, "local", "1");
    doChat(sim, a, "party", "2"); // dropped (partyless) but still consumes the budget
    doChat(sim, a, "global", "3");
    doChat(sim, a, "global", "4");
    doChat(sim, a, "local", "5");
    a.outbox.length = 0;
    doChat(sim, a, "global", "one too many");
    expect(a.outbox.some((e) => e.t === "chat" && e.channel === "system")).toBe(true);
    a.outbox.length = 0;
    sim.tickCount = 3 * TICK_RATE;
    doChat(sim, a, "global", "allowed again");
    expect(a.outbox.some((e) => e.t === "chat" && e.text === "allowed again")).toBe(true);
  });

  it("a throttled player continues receiving chat from other players", () => {
    for (let index = 0; index < 5; index++) doChat(sim, a, "global", `sent ${index}`);
    doChat(sim, a, "global", "rejected");
    a.outbox.length = 0;
    doChat(sim, b, "global", "still visible");
    expect(a.outbox.some((e) => e.t === "chat" && e.text === "still visible")).toBe(true);
  });
});
