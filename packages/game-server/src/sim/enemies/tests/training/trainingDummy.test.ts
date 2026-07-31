import {
  LEVEL,
  TICK_RATE,
  COMBAT_SANDBOX_LAYOUT,
  type EffectEvent,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { resolveDeaths } from "../../../combat/deaths.js";
import { addPlayer } from "../../../players/join.js";
import { applyEntityStatus } from "../../../progression/statusApplication.js";
import { realizeEffectEvents, tickStatuses } from "../../../progression/statuses.js";
import type { SimState } from "../../../state/state.js";
import { stepEnemies } from "../../ai.js";
import { activateChunksNearPlayers } from "../../population.js";
import {
  ensureCombatSandboxTrainingDummies,
  respawnTrainingDummies,
} from "../../training/trainingDummy.js";
import { activeTrainingWeaponHitbox } from "../../training/trainingDummyAttack.js";
import { MELEE_HITBOX_TIMING } from "../../../actions/melee/meleeHitboxTuning.js";
import {
  makeTrainingSandbox as makeSandbox,
  passiveTrainingDummy as populateDummy,
  trainingDummies,
} from "./trainingDummyTestSupport.js";

const DUMMY_ID = "training-dummy";
const SWORD_DUMMY_ID = "sword-training-dummy";

describe("sandbox training dummy", () => {
  it("seeds both configured targets only in the combat sandbox", () => {
    const sim = makeSandbox(LEVEL.CombatSandbox);
    activateChunksNearPlayers(sim);
    expect(trainingDummies(sim)).toHaveLength(2);
    expect(Math.hypot(
      COMBAT_SANDBOX_LAYOUT.trainingDummies.sword.x -
        COMBAT_SANDBOX_LAYOUT.trainingDummies.passive.x,
      COMBAT_SANDBOX_LAYOUT.trainingDummies.sword.y -
        COMBAT_SANDBOX_LAYOUT.trainingDummies.passive.y,
    )).toBeGreaterThanOrEqual(10);
    expect(trainingDummies(sim).find((dummy) => dummy.def.id === DUMMY_ID)?.entity.body)
      .toMatchObject(COMBAT_SANDBOX_LAYOUT.trainingDummies.passive);
    expect(trainingDummies(sim).find((dummy) => dummy.def.id === SWORD_DUMMY_ID)?.entity)
      .toMatchObject({
        body: {
          x: COMBAT_SANDBOX_LAYOUT.trainingDummies.sword.x,
          y: COMBAT_SANDBOX_LAYOUT.trainingDummies.sword.y,
        },
        facing: COMBAT_SANDBOX_LAYOUT.trainingDummies.sword.facing,
      });
    const ordinary = makeSandbox(LEVEL.Sandbox);
    activateChunksNearPlayers(ordinary);
    expect(trainingDummies(ordinary)).toHaveLength(0);
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
    ensureCombatSandboxTrainingDummies(sim);
    expect(player.stored.xp).toBe(25);
    expect(trainingDummies(sim)).toHaveLength(1);
    expect(sim.pendingEnemyRespawns).toHaveLength(1);
    expect(sim.items.size).toBe(0);
    assertNotRespawnedEarly(sim, defeatedAt);

    sim.tickCount++;
    respawnTrainingDummies(sim);
    ensureCombatSandboxTrainingDummies(sim);
    ensureCombatSandboxTrainingDummies(sim);
    expect(trainingDummies(sim)).toHaveLength(2);
    expect(sim.pendingEnemyRespawns).toHaveLength(0);
    expect(trainingDummies(sim).find((dummy) => dummy.def.id === DUMMY_ID)?.entity)
      .toMatchObject({ hp: 150, maxHp: 150 });
  });

  it("swings the ordinary sword hitbox every second against players only", () => {
    const sim = makeSandbox();
    const joined = addPlayer(sim, { name: "Target", clientId: "sword-target" });
    const player = sim.players.get(joined.playerId)!;
    player.spawnGraceUntilTick = 0;
    player.entity.body.x = COMBAT_SANDBOX_LAYOUT.trainingDummies.sword.x - 1.5;
    player.entity.body.y = COMBAT_SANDBOX_LAYOUT.trainingDummies.sword.y;
    ensureCombatSandboxTrainingDummies(sim);
    const sword = trainingDummies(sim).find((dummy) => dummy.def.id === SWORD_DUMMY_ID)!;
    const passive = trainingDummies(sim).find((dummy) => dummy.def.id === DUMMY_ID)!;
    passive.entity.body.x = COMBAT_SANDBOX_LAYOUT.trainingDummies.sword.x - 1;
    passive.entity.body.y = COMBAT_SANDBOX_LAYOUT.trainingDummies.sword.y;
    const passiveHp = passive.entity.hp;
    const effects: EffectEvent[] = [];

    stepEnemies(sim, effects);
    for (let tick = 1; tick <= TICK_RATE; tick++) {
      sim.tickCount = tick;
      stepEnemies(sim, effects);
    }

    expect(activeTrainingWeaponHitbox(sword)).toMatchObject({
      profile: { profileId: "sword", range: 2.4, arcCos: 0.7071 },
    });
    expect(player.entity.hp).toBeLessThan(player.entity.maxHp);
    expect(passive.entity.hp).toBe(passiveHp);

    for (let offset = 1; offset < MELEE_HITBOX_TIMING.lastResolutionOffsetTicks; offset++) {
      sim.tickCount = TICK_RATE + offset;
      stepEnemies(sim, effects);
    }
    expect(activeTrainingWeaponHitbox(sword)).toBeDefined();
    sim.tickCount = TICK_RATE + MELEE_HITBOX_TIMING.lastResolutionOffsetTicks;
    stepEnemies(sim, effects);
    expect(activeTrainingWeaponHitbox(sword)).toBeUndefined();
    expect(sword.animation.state).toBe("idle");
  });
});

function assertNotRespawnedEarly(sim: SimState, defeatedAt: number): void {
  sim.tickCount = defeatedAt + TICK_RATE - 1;
  respawnTrainingDummies(sim);
  expect(trainingDummies(sim)).toHaveLength(1);
}
