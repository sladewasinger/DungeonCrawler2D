/** Owns regression coverage for authored mini-boss arena target clearing. */
import { describe, expect, it } from "vitest";
import { spawnEnemy } from "../../../core/helpers.js";
import { prepareMiniBossArenaEnemy } from "../../miniBossArena/aggro.js";
import { beginDirectionalFlame } from "../../elemental/directionalFlame.js";
import { occupyMiniBossArena } from "../../miniBossArena/runtime.js";
import {
  addArenaPlayer,
  createMiniBossArenaSim,
  requiredArenaGate,
  spawnTestArena,
} from "./miniBossArenaTestSupport.js";

describe("mini-boss arena aggro", () => {
  it("clears a stale Chort sweep when its target leaves for another occupant", () => {
    const sim = createMiniBossArenaSim();
    const arena = spawnTestArena(sim);
    const inside = addArenaPlayer(sim, "inside", arena.center);
    const leaving = addArenaPlayer(sim, "leaving", arena.center);
    occupyMiniBossArena(sim, arena.key, inside.entity.id);
    occupyMiniBossArena(sim, arena.key, leaving.entity.id);
    const entity = spawnEnemy(sim, {
      defId: "chort", x: arena.center.x, y: arena.center.y, arenaKey: arena.key,
    });
    const enemy = sim.enemies.get(entity.id);
    if (!enemy) throw new Error("missing arena Chort");
    beginDirectionalFlame({ enemy, target: leaving.entity.body });
    enemy.animation = {
      state: "spit", ticksRemaining: 2,
      target: { targetId: leaving.entity.id, ...leaving.entity.body },
    };
    enemy.brain.targetId = leaving.entity.id;
    const gate = requiredArenaGate(arena.gates[0]);
    leaving.entity.body.x = gate.outside.x;
    leaving.entity.body.y = gate.outside.y;

    expect(prepareMiniBossArenaEnemy(sim, enemy)).toBe(true);
    expect(enemy.brain.targetId).toBeNull();
    expect(enemy.animation.state).toBe("idle");
    expect(enemy.elementalAttack).toBeUndefined();
    expect(inside.entity.body).toMatchObject(arena.center);
  });
});
