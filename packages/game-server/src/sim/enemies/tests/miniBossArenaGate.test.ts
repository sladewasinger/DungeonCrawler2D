import { containsPoint } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { doRescue } from "../../rescue/rescueAction.js";
import type { SimState } from "../../state/state.js";
import { stepMiniBossArenaBoundaries } from "../miniBossArena/boundary.js";
import { useMiniBossArenaGate } from "../miniBossArena/gate.js";
import { handleMiniBossEnemyDeath } from "../miniBossArena/population.js";
import {
  addArenaPlayer,
  createMiniBossArenaSim,
  spawnTestArena,
} from "./miniBossArenaTestSupport.js";

describe("ordinary mini-boss arena gate", () => {
  it("admits one player, seals both directions, and opens after victory", () => {
    const sim = createMiniBossArenaSim();
    const arena = spawnTestArena(sim);
    const gate = arena.gates[0];
    if (!gate) throw new Error("arena has no gate");
    const fighter = addArenaPlayer(sim, "fighter", gate.outside);
    const outsider = addArenaPlayer(sim, "outsider", gate.outside);

    expect(useMiniBossArenaGate({ sim, slot: fighter, gate })).toBe(true);
    expect(containsPoint(
      arena.interior,
      fighter.entity.body.x,
      fighter.entity.body.y,
    )).toBe(true);

    useMiniBossArenaGate({ sim, slot: outsider, gate });
    outsider.entity.body.x = arena.center.x + 0.5;
    outsider.entity.body.y = arena.center.y + 0.5;
    fighter.entity.body.x = gate.outside.x;
    fighter.entity.body.y = gate.outside.y;
    doRescue(sim, fighter);
    expect(fighter.outbox.at(-1)).toEqual({
      t: "toast",
      msg: "Use the arena gate. There is no rescue from a fight.",
    });
    stepMiniBossArenaBoundaries(sim);
    expect(containsPoint(
      arena.interior,
      outsider.entity.body.x,
      outsider.entity.body.y,
    )).toBe(false);
    expect(containsPoint(
      arena.interior,
      fighter.entity.body.x,
      fighter.entity.body.y,
    )).toBe(true);

    fighter.downedAtTick = sim.tickCount;
    stepMiniBossArenaBoundaries(sim);
    fighter.downedAtTick = null;
    fighter.entity.body.x = gate.outside.x;
    fighter.entity.body.y = gate.outside.y;
    stepMiniBossArenaBoundaries(sim);
    expect(containsPoint(
      arena.interior,
      fighter.entity.body.x,
      fighter.entity.body.y,
    )).toBe(true);

    defeatEncounter(sim, arena.key);
    useMiniBossArenaGate({ sim, slot: fighter, gate });
    expect(containsPoint(
      arena.interior,
      fighter.entity.body.x,
      fighter.entity.body.y,
    )).toBe(false);
  });
});

function defeatEncounter(sim: SimState, arenaKey: string): void {
  const encounter = [...sim.enemies.entries()]
    .filter(([, enemy]) => enemy.arenaKey === arenaKey);
  for (const [id, enemy] of encounter) {
    sim.enemies.delete(id);
    handleMiniBossEnemyDeath(sim, enemy);
  }
  expect(sim.defeatedMiniBossArenas.has(arenaKey)).toBe(true);
}
