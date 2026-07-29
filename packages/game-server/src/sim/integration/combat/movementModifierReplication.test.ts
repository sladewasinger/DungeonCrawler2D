import { describe, expect, it } from "vitest";
import type { GameSim } from "../../core/index.js";
import { makeSim } from "../support.js";

interface ModifierFixture {
  readonly statusId: "slowed" | "wet" | "oiled";
  readonly multiplier: number;
}

const MODIFIERS: readonly ModifierFixture[] = [
  { statusId: "slowed", multiplier: 0.6 },
  { statusId: "wet", multiplier: 0.85 },
  { statusId: "oiled", multiplier: 0.6 },
];

function applyModifier(sim: GameSim, fixture: ModifierFixture): number {
  const joined = sim.addPlayer({
    name: fixture.statusId,
    clientId: `client-${fixture.statusId}`,
  });
  const entity = sim.getPlayerEntity(joined.playerId);
  if (!entity) throw new Error("player fixture did not join");
  sim.effects.applyStatus({
    entity,
    statusId: fixture.statusId,
    events: [],
  });
  const snapshot = sim.step().get(joined.playerId);
  if (!snapshot) throw new Error("player fixture did not receive a snapshot");
  return snapshot.self.movementSpeed ?? 0;
}

describe("movement modifier replication", () => {
  it.each(MODIFIERS)(
    "replicates authoritative $statusId speed for client prediction",
    (fixture) => {
      const sim = makeSim();
      const expected = sim.addPlayer({
        name: "baseline",
        clientId: "client-baseline",
      });
      const baseSpeed = sim.getPlayerEntity(expected.playerId)?.baseSpeed ?? 0;

      expect(applyModifier(sim, fixture)).toBeCloseTo(
        baseSpeed * fixture.multiplier,
      );
    },
  );

  it("replicates composed continuous modifiers as one authoritative speed", () => {
    const sim = makeSim();
    const joined = sim.addPlayer({
      name: "stacked",
      clientId: "client-stacked",
    });
    const entity = sim.getPlayerEntity(joined.playerId);
    if (!entity) throw new Error("player fixture did not join");
    sim.effects.applyStatus({ entity, statusId: "slowed", events: [] });
    sim.effects.applyStatus({ entity, statusId: "wet", events: [] });

    const snapshot = sim.step().get(joined.playerId);
    expect(snapshot?.self.movementSpeed).toBeCloseTo(
      entity.baseSpeed * 0.6 * 0.85,
    );
  });
});
