import { describe, expect, it } from "vitest";
import { TICK_RATE, type SpectatorPresentation } from "@dc2d/engine";
import { SpectatorDeathPresentationJournal } from "./spectatorDeathPresentationJournal.js";

describe("spectator death presentation journal", () => {
  it("reconstructs a switched-away death once at its original age", () => {
    const journal = new SpectatorDeathPresentationJournal();
    journal.ingest(message(100, 80));
    expect(journal.drain(105)).toEqual([expect.objectContaining({
      id: "enemy-1",
      persistentOnly: true,
      ageMs: 25 * 1000 / TICK_RATE,
    })]);
    journal.ingest(message(110, 80));
    expect(journal.drain(110)).toEqual([]);
  });

  it("deduplicates a death already delivered live and drops expired history", () => {
    const journal = new SpectatorDeathPresentationJournal();
    journal.ingest(message(100, 80));
    journal.markLiveDeath(80, "enemy-1");
    expect(journal.drain(100)).toEqual([]);
    journal.ingest(message(80 + 60 * TICK_RATE, 80));
    expect(journal.drain(80 + 60 * TICK_RATE)).toEqual([]);
  });
});

function message(tick: number, occurredAtTick: number): SpectatorPresentation {
  return {
    type: "spectatorPresentation",
    worldIdentity: "dungeon:1",
    tick,
    deaths: [{
      id: "enemy-1",
      occurredAtTick,
      x: 2,
      y: 3,
      defId: "slime",
      targetKind: "enemy",
    }],
  };
}
