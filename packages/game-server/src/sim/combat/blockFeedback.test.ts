import type { Entity, GameEvent } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { notifyBlockFeedback } from "./blockFeedback.js";
import type { PlayerSlot, SimState } from "../state/state.js";

describe("authoritative block feedback", () => {
  it("routes melee and projectile confirmations to the blocking player", () => {
    const outbox: GameEvent[] = [];
    const slot = { outbox } as unknown as PlayerSlot;
    const sim = { players: new Map([["player", slot]]) } as unknown as SimState;
    const victim = { id: "player", kind: "player" } as Entity;

    notifyBlockFeedback(sim, victim, "melee");
    notifyBlockFeedback(sim, victim, "projectile");

    expect(outbox).toEqual([
      { t: "blockFeedback", kind: "melee" },
      { t: "blockFeedback", kind: "projectile" },
    ]);
  });
});
