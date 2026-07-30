import {
  TICK_DT,
  containsPoint,
  createBody,
  stepBody,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { buildSnapshots } from "../../../snapshots/snapshots.js";
import type { PlayerSlot, SimState } from "../../../state/state.js";
import { stepMiniBossArenaBoundaries } from "../../miniBossArena/boundary.js";
import { useMiniBossArenaGate } from "../../miniBossArena/gate.js";
import { miniBossArenaGateOverrides } from "../../miniBossArena/gateOverrides.js";
import {
  miniBossArenaEntryForPlayer,
  occupiesMiniBossArena,
} from "../../miniBossArena/runtime.js";
import {
  addArenaPlayer,
  advanceTestArenaEntry,
  arenaEntryDirection,
  createMiniBossArenaSim,
  defeatTestArenaBoss,
  requiredArenaGate,
  spawnTestArena,
} from "./miniBossArenaTestSupport.js";

describe("ordinary mini-boss arena gate", () => {
  it("blocks ordinary movement while closed", () => {
    const sim = createMiniBossArenaSim();
    const arena = spawnTestArena(sim);
    const gate = requiredArenaGate(arena.gates[0]);
    const body = createBody(gate.outside.x, gate.outside.y, 0);
    const direction = arenaEntryDirection(gate);

    expect(sim.world.isWalkable(gate.x, gate.y)).toBe(false);
    for (let tick = 0; tick < 20; tick++) {
      stepBody(sim.world, body, {
        moveX: direction.x,
        moveY: direction.y,
        jump: false,
      }, TICK_DT);
    }
    expect(containsPoint(arena.interior, body.x, body.y)).toBe(false);
  });

  it("pulls over multiple authoritative ticks without teleporting", () => {
    const sim = createMiniBossArenaSim();
    const arena = spawnTestArena(sim);
    const gate = requiredArenaGate(arena.gates[0]);
    const fighter = addArenaPlayer(sim, "fighter", gate.outside);

    expect(useMiniBossArenaGate({ sim, slot: fighter, gate })).toBe(true);
    expect(sim.world.isWalkable(gate.x, gate.y)).toBe(true);
    expect(miniBossArenaGateOverrides(sim).map(({ x, y }) => ({ x, y })))
      .toEqual([{ x: gate.x, y: gate.y }]);
    for (const sealed of arena.gates.slice(1)) {
      expect(sim.world.isWalkable(sealed.x, sealed.y)).toBe(false);
    }
    const positions = advanceTestArenaEntry(sim, fighter);

    expect(positions.length).toBeGreaterThan(2);
    expect(positions[0]).not.toEqual(gate.inside);
    expect(fighter.entity.body).toMatchObject(gate.inside);
    expect(occupiesMiniBossArena(sim, fighter.entity.id)).toBe(true);
    expect(fighter.outbox.some(({ t }) => t === "teleported")).toBe(false);
  });

  it("keeps a second player from following through the temporary opening", () => {
    const sim = createMiniBossArenaSim();
    const arena = spawnTestArena(sim);
    const gate = requiredArenaGate(arena.gates[0]);
    const fighter = addArenaPlayer(sim, "fighter", gate.outside);
    const follower = addArenaPlayer(sim, "follower", gate.outside);

    useMiniBossArenaGate({ sim, slot: fighter, gate });
    follower.entity.body.x = gate.inside.x;
    follower.entity.body.y = gate.inside.y;
    stepMiniBossArenaBoundaries(sim);

    expect(follower.entity.body).toMatchObject(gate.outside);
    expect(occupiesMiniBossArena(sim, follower.entity.id)).toBe(false);
    expect(follower.outbox.some(({ t }) => t === "teleported")).toBe(false);
  });

  it("reseals behind the entrant and preserves the occupant lock", () => {
    const sim = createMiniBossArenaSim();
    const arena = spawnTestArena(sim);
    const gate = requiredArenaGate(arena.gates[0]);
    const fighter = addArenaPlayer(sim, "fighter", gate.outside);
    const outsider = addArenaPlayer(sim, "outsider", gate.outside);

    useMiniBossArenaGate({ sim, slot: fighter, gate });
    finishEntry(sim, fighter);
    expect(sim.world.isWalkable(gate.x, gate.y)).toBe(false);

    expect(useMiniBossArenaGate({ sim, slot: outsider, gate })).toBe(true);
    expect(miniBossArenaEntryForPlayer(sim, outsider.entity.id)).toBeUndefined();
    expect(outsider.outbox.at(-1)).toEqual({
      t: "toast",
      msg: "The arena is sealed. Someone else is fighting.",
    });

    fighter.entity.body.x = gate.outside.x;
    fighter.entity.body.y = gate.outside.y;
    stepMiniBossArenaBoundaries(sim);
    expect(fighter.entity.body).toMatchObject(gate.inside);
    expect(fighter.outbox.some(({ t }) => t === "teleported")).toBe(false);
  });

  it("cancels a dead entrant and releases the arena after occupant death", () => {
    const sim = createMiniBossArenaSim();
    const arena = spawnTestArena(sim);
    const gate = requiredArenaGate(arena.gates[0]);
    const first = addArenaPlayer(sim, "first", gate.outside);
    const second = addArenaPlayer(sim, "second", gate.outside);

    useMiniBossArenaGate({ sim, slot: first, gate });
    stepMiniBossArenaBoundaries(sim);
    first.entity.hp = 0;
    stepMiniBossArenaBoundaries(sim);
    expect(miniBossArenaEntryForPlayer(sim, first.entity.id)).toBeUndefined();
    expect(sim.world.isWalkable(gate.x, gate.y)).toBe(false);

    useMiniBossArenaGate({ sim, slot: second, gate });
    finishEntry(sim, second);
    second.entity.hp = 0;
    stepMiniBossArenaBoundaries(sim);
    first.entity.hp = first.entity.maxHp;
    first.entity.body.x = gate.outside.x;
    first.entity.body.y = gate.outside.y;
    expect(useMiniBossArenaGate({ sim, slot: first, gate })).toBe(true);
    expect(miniBossArenaEntryForPlayer(sim, first.entity.id)).toBeDefined();
  });

  it("permanently unlocks every gate and removes server interaction", () => {
    const sim = createMiniBossArenaSim();
    const arena = spawnTestArena(sim);
    const gate = requiredArenaGate(arena.gates[0]);
    const fighter = addArenaPlayer(sim, "fighter", gate.outside);
    defeatTestArenaBoss(sim, arena.key);
    expect(sim.defeatedMiniBossArenas.has(arena.key)).toBe(true);
    expect(sim.enemies.size).toBe(3);
    const released = [...sim.enemies.values()].every((enemy) => enemy.arenaKey === undefined && enemy.home === undefined);
    expect(released).toBe(true);

    for (const unlocked of arena.gates) {
      expect(sim.world.isWalkable(unlocked.x, unlocked.y)).toBe(true);
      expect(sim.world.featureAt(unlocked.x, unlocked.y)).toBe(0);
    }
    const before = { ...fighter.entity.body };
    const eventCount = fighter.outbox.length;
    expect(useMiniBossArenaGate({ sim, slot: fighter, gate })).toBe(false);
    expect(fighter.entity.body).toEqual(before);
    expect(fighter.outbox).toHaveLength(eventCount);
    const replicated = buildSnapshots(sim).get(fighter.entity.id)?.miniBossArenaGates;
    const expected = arena.gates.map(({ x, y }) => ({ x, y }));
    expect(replicated).toHaveLength(expected.length);
    expect(replicated).toEqual(expect.arrayContaining(expected));
  });

});

function finishEntry(sim: SimState, slot: PlayerSlot): void {
  advanceTestArenaEntry(sim, slot);
  expect(miniBossArenaEntryForPlayer(sim, slot.entity.id)).toBeUndefined();
  expect(occupiesMiniBossArena(sim, slot.entity.id)).toBe(true);
}
