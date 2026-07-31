import {
  LEVEL,
  TICK_RATE,
  World,
  buildContentRegistry,
  hashString,
  type EffectEvent,
} from "@dc2d/engine";
import {
  areaReactionsData,
  areasData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import { describe, expect, it } from "vitest";
import { PlayerStore } from "../../../../store.js";
import { resolveDeaths } from "../../../combat/deaths.js";
import { addPlayer } from "../../../players/join.js";
import { applyEntityStatus } from "../../../progression/statusApplication.js";
import { realizeEffectEvents, tickStatuses } from "../../../progression/statuses.js";
import { createSimState, type SimState } from "../../../state/state.js";
import { stepEnemies } from "../../ai.js";
import { activateChunksNearPlayers } from "../../population.js";
import {
  ensureSandboxTrainingDummy,
  respawnTrainingDummies,
} from "../../training/trainingDummy.js";

const DUMMY_ID = "training-dummy";

describe("sandbox training dummy", () => {
  it("auto-seeds in an ordinary sandbox without general test fixtures", () => {
    const sim = makeSandbox(false);
    activateChunksNearPlayers(sim);
    expect(trainingDummies(sim)).toHaveLength(1);
  });

  it("stays still while remaining a normal damage and fire target", () => {
    const sim = makeSandbox();
    const dummy = populateDummy(sim);
    const initial = { x: dummy.entity.body.x, y: dummy.entity.body.y };
    const effects: EffectEvent[] = [];
    dummy.entity.body.kx = 4;

    stepEnemies(sim, effects);
    expect(dummy.entity.body).toMatchObject(initial);
    expect(dummy.entity.body.kx).toBe(0);
    expect(applyEntityStatus({
      sim,
      entity: dummy.entity,
      statusId: "on-fire",
      effectEvents: effects,
    })).toBe(true);
    for (let tick = 0; tick < TICK_RATE; tick++) tickStatuses(sim, effects);
    realizeEffectEvents(sim, effects);
    expect(dummy.entity.hp).toBeLessThan(dummy.entity.maxHp);
    expect(sim.worldEvents.some((event) => event.ev.t === "damageImpact")).toBe(true);
  });

  it("grants XP and returns at full health exactly one second after defeat", () => {
    const sim = makeSandbox();
    const joined = addPlayer(sim, { name: "Tester", clientId: "dummy-tester" });
    const player = sim.players.get(joined.playerId)!;
    const dummy = populateDummy(sim);
    const defeatedAt = 40;
    sim.tickCount = defeatedAt;
    dummy.lastDamageSourceId = joined.playerId;
    dummy.entity.hp = 0;

    resolveDeaths(sim);
    ensureSandboxTrainingDummy(sim);
    expect(player.stored.xp).toBe(25);
    expect(trainingDummies(sim)).toHaveLength(0);
    expect(sim.pendingEnemyRespawns).toHaveLength(1);
    expect(sim.items.size).toBe(0);
    assertNotRespawnedEarly(sim, defeatedAt);

    sim.tickCount++;
    respawnTrainingDummies(sim);
    ensureSandboxTrainingDummy(sim);
    ensureSandboxTrainingDummy(sim);
    expect(trainingDummies(sim)).toHaveLength(1);
    expect(sim.pendingEnemyRespawns).toHaveLength(0);
    expect(trainingDummies(sim)[0]?.entity).toMatchObject({ hp: 30, maxHp: 30 });
  });
});

function assertNotRespawnedEarly(sim: SimState, defeatedAt: number): void {
  sim.tickCount = defeatedAt + TICK_RATE - 1;
  respawnTrainingDummies(sim);
  expect(trainingDummies(sim)).toHaveLength(0);
}

function makeSandbox(testFixtures = true): SimState {
  return createSimState({
    world: new World(hashString("training-dummy-test"), 1, LEVEL.Sandbox),
    content: buildContentRegistry({
      statuses: [...statusesData],
      rules: [...rulesData],
      areas: [...areasData],
      areaReactions: [...areaReactionsData],
      items: [...itemsData],
      enemies: [...enemiesData],
      recipes: [...recipesData],
    }),
    store: new PlayerStore(null),
    rngSeed: 1,
    opts: { testFixtures },
  });
}

function populateDummy(sim: SimState) {
  ensureSandboxTrainingDummy(sim);
  const dummy = trainingDummies(sim)[0];
  if (!dummy) throw new Error("training dummy fixture did not spawn");
  return dummy;
}

function trainingDummies(sim: SimState) {
  return [...sim.enemies.values()].filter((enemy) => enemy.def.id === DUMMY_ID);
}
