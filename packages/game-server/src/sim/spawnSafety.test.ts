import {
  areasData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import {
  CHASM_DEATH_Z,
  LEVEL,
  PLAYER_MAX_HP,
  World,
  buildContentRegistry,
  hashString,
  type ContentRegistry,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { PlayerStore } from "../store.js";
import { spawnEnemy } from "./helpers.js";
import { addPlayer } from "./join.js";
import { reapAndRespawn } from "./players.js";
import { SPAWN_CLEARANCE_RADIUS, SPAWN_GRACE_TICKS, enforceSpawnClearance } from "./spawnSafety.js";
import { createSimState, type SimState } from "./state.js";
import { blanketSpawnNeighborhood, openFloorNear } from "./spawnSafety/testSupport.js";

/**
 * Spawn-safety CLEARANCE (panel round 3b blocker #1): no living hostile
 * within SPAWN_CLEARANCE_RADIUS of the entry/respawn tile at control
 * handoff. Grace-window coverage lives in spawnGrace.test.ts; the
 * multi-seed sweep in spawnSafety.fuzz.test.ts.
 */

const content: ContentRegistry = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});

function makeDungeonSim(seedText: string, rngSeed: number, opts: SimState["opts"] = {}): SimState {
  const world = new World(hashString(seedText), 1, LEVEL.Dungeon);
  return createSimState({ world, content, store: new PlayerStore(null), rngSeed, opts });
}

function nearestHostileDistance(sim: SimState, x: number, y: number): number {
  let nearest = Infinity;
  for (const enemy of sim.enemies.values()) {
    nearest = Math.min(nearest, Math.hypot(enemy.entity.body.x - x, enemy.entity.body.y - y));
  }
  return nearest;
}

describe("enforceSpawnClearance", () => {
  it("teleports a hostile parked on the spawn tile to walkable floor outside the radius", () => {
    const sim = makeDungeonSim("spawn-safety-unit", 42);
    const spot = openFloorNear(sim, { x: 200, y: 200 });
    const camper = spawnEnemy(sim, { defId: "slime", x: spot.x, y: spot.y }); // parked dead-on
    const far = openFloorNear(sim, { x: 230, y: 200 });
    const bystander = spawnEnemy(sim, { defId: "slime", x: far.x, y: far.y });
    // Fixture sanity: the bystander really is outside the radius already.
    expect(Math.hypot(far.x - spot.x, far.y - spot.y)).toBeGreaterThan(SPAWN_CLEARANCE_RADIUS);

    enforceSpawnClearance(sim, [{ x: spot.x, y: spot.y }]);

    const moved = Math.hypot(camper.body.x - spot.x, camper.body.y - spot.y);
    expect(moved).toBeGreaterThanOrEqual(SPAWN_CLEARANCE_RADIUS);
    const tx = Math.floor(camper.body.x);
    const ty = Math.floor(camper.body.y);
    expect(sim.world.isWalkable(tx, ty)).toBe(true);
    expect(sim.world.heightAt(tx, ty)).toBeGreaterThan(CHASM_DEATH_Z);
    expect(camper.hp).toBeGreaterThan(0); // relocated, not culled
    // Untouched: relocation is surgical, not an area wipe.
    expect(bystander.body.x).toBe(far.x);
    expect(bystander.body.y).toBe(far.y);
  });

  it("two hostiles on the same entry tile land on distinct tiles, both clear", () => {
    const sim = makeDungeonSim("spawn-safety-unit", 42);
    const spot = openFloorNear(sim, { x: 200, y: 200 });
    const first = spawnEnemy(sim, { defId: "skeleton", x: spot.x, y: spot.y });
    const second = spawnEnemy(sim, { defId: "skeleton", x: spot.x, y: spot.y });

    enforceSpawnClearance(sim, [{ x: spot.x, y: spot.y }]);

    for (const body of [first.body, second.body]) {
      expect(Math.hypot(body.x - spot.x, body.y - spot.y)).toBeGreaterThanOrEqual(SPAWN_CLEARANCE_RADIUS);
    }
    const tileOf = (b: { x: number; y: number }) => `${Math.floor(b.x)},${Math.floor(b.y)}`;
    expect(tileOf(first.body)).not.toBe(tileOf(second.body));
  });
});

describe("spawn handoff safety", () => {
  it("a join whose entry tile has a camping hostile hands over clear + grace-protected", () => {
    // Twin sims, identical seeds: A reveals where the join will land,
    // B parks a skeleton exactly there first (spawnEnemy consumes no
    // rng, so B's findSpawn replays A's byte-for-byte).
    const simA = makeDungeonSim("spawn-safety-handoff", 7, { spawnRadiusTiles: 12 });
    const joinA = addPlayer(simA, { name: "Scout", clientId: "client-s" });

    const simB = makeDungeonSim("spawn-safety-handoff", 7, { spawnRadiusTiles: 12 });
    spawnEnemy(simB, { defId: "skeleton", x: joinA.spawn.x, y: joinA.spawn.y });
    const joinB = addPlayer(simB, { name: "Scout", clientId: "client-s" });

    expect(joinB.spawn).toEqual(joinA.spawn); // the ambush really was on the entry tile
    expect(nearestHostileDistance(simB, joinB.spawn.x, joinB.spawn.y)).toBeGreaterThanOrEqual(
      SPAWN_CLEARANCE_RADIUS,
    );
    const slot = simB.players.get(joinB.playerId)!;
    expect(slot.spawnGraceUntilTick).toBe(simB.tickCount + SPAWN_GRACE_TICKS);
  });

  it("death respawn into a hostile-blanketed neighborhood still hands over clear", () => {
    const sim = makeDungeonSim("spawn-safety-respawn", 11, { spawnRadiusTiles: 12 });
    const join = addPlayer(sim, { name: "Doomed", clientId: "client-d" });
    const slot = sim.players.get(join.playerId)!;

    // Blanket every reachable tile of the spawn neighborhood so ANY
    // respawn tile has a camper within ~2.2 tiles — pre-fix, a
    // guaranteed ambush.
    const parked = blanketSpawnNeighborhood(sim);
    expect(parked.length).toBeGreaterThan(20); // dense enough to mean something

    slot.entity.hp = 0;
    slot.respawnAtTick = sim.tickCount;
    reapAndRespawn(sim);

    const { x, y } = slot.entity.body;
    // The ambush WOULD have existed: some pre-relocation camper sat
    // inside the radius of the respawn tile...
    const preFix = Math.min(...parked.map((p) => Math.hypot(p.x - x, p.y - y)));
    expect(preFix).toBeLessThan(SPAWN_CLEARANCE_RADIUS);
    // ...and the handoff is clear anyway, at full hp, with grace armed.
    expect(nearestHostileDistance(sim, x, y)).toBeGreaterThanOrEqual(SPAWN_CLEARANCE_RADIUS);
    expect(slot.entity.hp).toBe(PLAYER_MAX_HP);
    expect(slot.spawnGraceUntilTick).toBe(sim.tickCount + SPAWN_GRACE_TICKS);
  });
});
