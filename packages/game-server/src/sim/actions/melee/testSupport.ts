import { type EffectEvent, type Entity } from "@dc2d/engine";
import { spawnEnemy } from "../../core/helpers.js";
import {
  addEnemyTestPlayer,
  createEnemyTestSim,
  findEnemyTestFloor,
} from "../../enemies/tests/enemyAiTestSupport.js";
import type { PlayerSlot, SimState } from "../../state/state.js";
import { doAttack, stepActiveMeleeAttacks } from "../melee.js";

export interface MeleeFixture {
  readonly sim: SimState;
  readonly player: PlayerSlot;
  readonly spot: { readonly x: number; readonly y: number };
}

export function createMeleeFixture(): MeleeFixture {
  const sim = createEnemyTestSim();
  const spot = findEnemyTestFloor(sim);
  const player = addEnemyTestPlayer(sim, spot);
  player.weapon = "sword";
  return { sim, player, spot };
}

export function spawnSpitter(fixture: MeleeFixture, xOffset: number): Entity {
  const enemy = spawnEnemy(fixture.sim, {
    defId: "spitter",
    x: fixture.spot.x + xOffset,
    y: fixture.spot.y,
  });
  enemy.body.z = fixture.player.entity.body.z;
  return enemy;
}

export function attack(fixture: MeleeFixture): void {
  const effectEvents: EffectEvent[] = [];
  doAttack({
    sim: fixture.sim,
    slot: fixture.player,
    dirX: 1,
    dirY: 0,
    effectEvents,
  });
}

export function advanceMeleeTick(fixture: MeleeFixture, tick: number): void {
  const effectEvents: EffectEvent[] = [];
  fixture.sim.tickCount = tick;
  stepActiveMeleeAttacks(fixture.sim, effectEvents);
}
