import { describe, expect, it } from "vitest";
import { createBody } from "../entities/movement/index.js";
import { makeEntity, type Entity } from "../entities/entity.js";
import { buildContentRegistry, type RawContent } from "./types.js";
import { EffectsEngine, type EffectEvent } from "./system.js";

const SOURCE_PROBE_ID = "source-probe";

const SOURCE_PROBE: RawContent = {
  statuses: [{
    id: SOURCE_PROBE_ID,
    name: "Source Probe",
    kind: "debuff",
    tags: ["probe"],
    duration: 1,
    tickEvery: 0.5,
    stacking: "refresh",
    onApply: [{ primitive: "modify_health", amount: -1 }],
    onRefresh: [{ primitive: "modify_health", amount: -1 }],
    onTick: [{ primitive: "modify_health", amount: -1 }],
    onExpire: [{ primitive: "modify_health", amount: -1 }],
  }],
  rules: [],
  areas: [],
  items: [],
  enemies: [],
  recipes: [],
};

function makeProbeEngine(): EffectsEngine {
  return new EffectsEngine(buildContentRegistry(SOURCE_PROBE), () => false);
}

function makeProbeTarget(): Entity {
  return makeEntity("player", createBody(0, 0, 0), { hp: 30, maxHp: 30, baseSpeed: 8 });
}

describe("effect source attribution", () => {
  it("preserves a status source through apply, refresh, tick, and expiry", () => {
    const engine = makeProbeEngine();
    const target = makeProbeTarget();
    const events: EffectEvent[] = [];

    engine.applyStatus({ entity: target, statusId: SOURCE_PROBE_ID, sourceId: "first", events });
    engine.applyStatus({ entity: target, statusId: SOURCE_PROBE_ID, sourceId: "second", events });
    engine.tick({ entity: target, dt: 1, events });

    const healthEvents = events.filter((event) => event.t === "hp");
    expect(healthEvents).toHaveLength(5);
    expect(healthEvents.map((event) => event.sourceId)).toEqual([
      "first",
      "second",
      "second",
      "second",
      "second",
    ]);
  });
});
