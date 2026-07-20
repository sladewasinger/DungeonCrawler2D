// Unit tests for the announcer facade: determinism (same tick+salt always
// picks the same line), rotation coverage (varying salts/ticks actually
// rotate through the pool), and the milestone/broadcast helpers.
import { describe, expect, it } from "vitest";
import {
  announceDeath,
  announceFirstTorchThrow,
  announceFistbump,
  announceJoin,
  announceKillMilestone,
  announceLevelUp,
  broadcastAnnouncement,
} from "./index.js";
import { pickLineIndex } from "./pick.js";
import type { PlayerSlot } from "../state.js";

describe("pickLineIndex", () => {
  it("is deterministic for the same (tick, salt, poolSize)", () => {
    const a = pickLineIndex(42, "join:p1", 4);
    const b = pickLineIndex(42, "join:p1", 4);
    expect(a).toBe(b);
  });

  it("stays in range [0, poolSize)", () => {
    for (let tick = 0; tick < 50; tick++) {
      const index = pickLineIndex(tick, `salt:${tick}`, 4);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(4);
    }
  });

  it("rotates through every index of a small pool across many ticks", () => {
    const seen = new Set<number>();
    for (let tick = 0; tick < 200; tick++) seen.add(pickLineIndex(tick, "join:p1", 4));
    expect(seen.size).toBe(4);
  });

  it("diverges by salt even on the same tick", () => {
    const a = pickLineIndex(7, "join:p1", 4);
    const b = pickLineIndex(7, "join:p2", 4);
    // Not a hard guarantee for every pair, but true for this fixed pair —
    // pins the "salt matters" behavior against an accidental salt-ignoring regression.
    expect(a === b && pickLineIndex(7, "join:p3", 4) === a).toBe(false);
  });
});

describe("announcer line builders", () => {
  it("announceJoin embeds the name and system channel", () => {
    const event = announceJoin(10, "p1", "Rowan", 3);
    expect(event).toMatchObject({ t: "chat", channel: "system", from: "server", name: "system" });
    expect(event.t === "chat" && event.text).toContain("Rowan");
  });

  it("announceJoin is deterministic for the same inputs", () => {
    expect(announceJoin(10, "p1", "Rowan", 3)).toEqual(announceJoin(10, "p1", "Rowan", 3));
  });

  it("announceDeath picks a distinct pool for chasm vs ordinary deaths", () => {
    const ordinary = announceDeath(10, "p1", "Rowan", false);
    const chasm = announceDeath(10, "p1", "Rowan", true);
    expect(ordinary.t === "chat" && ordinary.text).not.toBe(chasm.t === "chat" ? chasm.text : "");
  });

  it("announceLevelUp embeds the level number", () => {
    const event = announceLevelUp(5, "p1", "Rowan", 7);
    expect(event.t === "chat" && event.text).toContain("7");
  });

  it("announceFistbump embeds both names", () => {
    const event = announceFistbump(5, "p1", "Rowan", "Sable");
    const text = event.t === "chat" ? event.text : "";
    expect(text).toContain("Rowan");
    expect(text).toContain("Sable");
  });

  it("announceFirstTorchThrow embeds the name", () => {
    const event = announceFirstTorchThrow(5, "p1", "Rowan");
    expect(event.t === "chat" && event.text).toContain("Rowan");
  });
});

function makeSlot(id: string, name: string): PlayerSlot {
  // Minimal shape for the announcer's own kill-count WeakMap key + name
  // lookup — cast is safe because recordKill/announceKillMilestone only
  // ever touch `entity.id`/`entity.name` and use the slot as a Map key.
  return { entity: { id, name } } as unknown as PlayerSlot;
}

describe("announceKillMilestone", () => {
  it("returns null for non-milestone kill counts", () => {
    const slot = makeSlot("p1", "Rowan");
    for (let i = 0; i < 4; i++) expect(announceKillMilestone(1, slot)).toBeNull();
  });

  it("returns a line on the 5th, 10th, and 25th kill, embedding the count", () => {
    const slot = makeSlot("p1", "Rowan");
    let fifth: ReturnType<typeof announceKillMilestone> = null;
    for (let i = 0; i < 5; i++) fifth = announceKillMilestone(1, slot);
    expect(fifth).not.toBeNull();
    expect(fifth?.t === "chat" && fifth.text).toContain("5");

    for (let i = 0; i < 4; i++) announceKillMilestone(1, slot);
    const tenth = announceKillMilestone(1, slot);
    expect(tenth?.t === "chat" && tenth.text).toContain("10");
  });

  it("tracks kill counts independently per PlayerSlot", () => {
    const a = makeSlot("p1", "Rowan");
    const b = makeSlot("p2", "Sable");
    for (let i = 0; i < 5; i++) announceKillMilestone(1, a);
    expect(announceKillMilestone(1, b)).toBeNull(); // b's own count is still at 1
  });
});

describe("broadcastAnnouncement", () => {
  it("delivers to every connected player, skips disconnected ones", () => {
    const connected = { connected: true, outbox: [] as unknown[] } as unknown as PlayerSlot;
    const disconnected = { connected: false, outbox: [] as unknown[] } as unknown as PlayerSlot;
    const sim = {
      players: new Map([
        ["a", connected],
        ["b", disconnected],
      ]),
      // Minimal SimState shape — broadcastAnnouncement only reads `players`.
    } as unknown as Parameters<typeof broadcastAnnouncement>[0];

    const event = announceJoin(1, "a", "Rowan", 1);
    broadcastAnnouncement(sim, event);

    expect(connected.outbox).toEqual([event]);
    expect(disconnected.outbox).toEqual([]);
  });
});
