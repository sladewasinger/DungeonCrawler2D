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
  type ServerSnapshot,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { PlayerStore } from "../store.js";
import { spawnEnemy } from "./helpers.js";
import { GameSim } from "./index.js";
import { addPlayer } from "./join.js";
import { reapAndRespawn } from "./players.js";
import { resolveSpawnAnchor } from "./spawn.js";
import { SPAWN_CLEARANCE_RADIUS, SPAWN_GRACE_TICKS } from "./spawnSafety.js";
import { createSimState, type SimState } from "./state.js";

/**
 * Multi-seed spawn-safety sweep. Two layers:
 *  1. HANDOFF (panel round 3b blocker #1): across 20 worlds, blanket the
 *     spawn neighborhood with hostiles, join/die/respawn, and assert the
 *     clearance radius + armed grace at the handoff instant.
 *  2. WHOLE-WINDOW (panel round 4, Grinder's drift-in leak): across 20
 *     worlds, run the REAL GameSim.step() tick loop and assert at EVERY
 *     graced tick — via the player's own replicated snapshot — that no
 *     hostile sits inside the radius and no damage lands before the
 *     first input, for both the join grace and the respawn grace.
 * Deliberately generous timeouts: 20 BSP worlds each is real work on slow CI.
 */

const SEED_COUNT = 20;
const FUZZ_TIMEOUT_MS = 180_000;

const content: ContentRegistry = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});

/** Park a slime on every 3rd walkable tile of the spawn neighborhood. */
function blanketHostiles(sim: SimState): number {
  const anchor = resolveSpawnAnchor(sim);
  let parked = 0;
  for (let y = anchor.y - 20; y <= anchor.y + 20; y += 3) {
    for (let x = anchor.x - 20; x <= anchor.x + 20; x += 3) {
      if (!sim.world.isWalkable(x, y) || sim.world.isSanctuary(x, y)) continue;
      if (sim.world.heightAt(x, y) <= CHASM_DEATH_Z) continue;
      spawnEnemy(sim, "slime", x + 0.5, y + 0.5);
      parked++;
    }
  }
  return parked;
}

function nearestHostileDistance(sim: SimState, x: number, y: number): number {
  let nearest = Infinity;
  for (const enemy of sim.enemies.values()) {
    nearest = Math.min(nearest, Math.hypot(enemy.entity.body.x - x, enemy.entity.body.y - y));
  }
  return nearest;
}

describe("spawn safety across seeds", () => {
  it(
    `join + die + respawn hands over hostile-clear and grace-armed on ${SEED_COUNT} seeds`,
    () => {
      for (let seed = 1; seed <= SEED_COUNT; seed++) {
        const world = new World(hashString(`spawn-fuzz-${seed}`), 1, LEVEL.Dungeon);
        const sim = createSimState(world, content, new PlayerStore(null), seed, {
          spawnRadiusTiles: 12,
        });
        expect(blanketHostiles(sim), `seed ${seed}: blanket too sparse`).toBeGreaterThan(10);

        // Handoff 1: fresh join.
        const join = addPlayer(sim, "Fuzz", `client-${seed}`);
        const slot = sim.players.get(join.playerId)!;
        expect(
          nearestHostileDistance(sim, join.spawn.x, join.spawn.y),
          `seed ${seed}: hostile inside clearance at join`,
        ).toBeGreaterThanOrEqual(SPAWN_CLEARANCE_RADIUS);
        expect(slot.spawnGraceUntilTick).toBe(sim.tickCount + SPAWN_GRACE_TICKS);

        // Handoff 2: death respawn.
        slot.entity.hp = 0;
        slot.respawnAtTick = sim.tickCount;
        reapAndRespawn(sim);
        const { x, y } = slot.entity.body;
        expect(
          nearestHostileDistance(sim, x, y),
          `seed ${seed}: hostile inside clearance at respawn`,
        ).toBeGreaterThanOrEqual(SPAWN_CLEARANCE_RADIUS);
        expect(slot.entity.hp).toBe(PLAYER_MAX_HP);
        expect(slot.spawnGraceUntilTick).toBe(sim.tickCount + SPAWN_GRACE_TICKS);
      }
    },
    FUZZ_TIMEOUT_MS,
  );

  it(
    `the clearance invariant holds at EVERY graced tick under live pressure on ${SEED_COUNT} seeds (round 4)`,
    () => {
      for (let seed = 1; seed <= SEED_COUNT; seed++) {
        const world = new World(hashString(`grace-fuzz-${seed}`), 1, LEVEL.Dungeon);
        const sim = new GameSim(world, content, new PlayerStore(null), seed, {
          spawnRadiusTiles: 12,
          debugCommands: true, // test-only: the bait teleport below
        });
        // A non-graced bait player keeps the blanket in the enemies'
        // active set (graced players are invisible to enemy think, so a
        // lone graced join would freeze the world and prove nothing).
        const bait = sim.addPlayer("Bait", `bait-${seed}`);
        sim.endSpawnGrace(bait.playerId);
        const join = sim.addPlayer("Fuzz", `fuzz-${seed}`);
        // Park the bait ON the graced spawn: nearby hostiles aggro the
        // bait and actively press INTO the protected radius all window
        // long — real drift-in pressure, not just idle wander (the clamp
        // is what must hold the line).
        sim.queueAction(bait.playerId, { type: "debug", op: "teleport", x: join.spawn.x, y: join.spawn.y });
        // Blanket AFTER the handoff sweep, deliberately INSIDE the radius
        // too — standing in for round 4's population/relocation races.
        // The first post-population sweep must evict them before they act.
        let parked = 0;
        for (let dy = -20; dy <= 20; dy += 4) {
          for (let dx = -20; dx <= 20; dx += 4) {
            const tx = Math.floor(join.spawn.x) + dx;
            const ty = Math.floor(join.spawn.y) + dy;
            if (!world.isWalkable(tx, ty) || world.isSanctuary(tx, ty)) continue;
            if (world.heightAt(tx, ty) <= CHASM_DEATH_Z) continue;
            sim.spawnEnemy("slime", tx + 0.5, ty + 0.5);
            parked++;
          }
        }
        expect(parked, `seed ${seed}: blanket too sparse`).toBeGreaterThan(10);

        sampleGraceWindow(sim, join.playerId, sim.tick + SPAWN_GRACE_TICKS, `seed ${seed} join`);

        // Die, wait out the respawn delay through the real loop, then
        // sample the respawn grace the same way — and confirm the round-4
        // respawn kit re-arm while we're standing at the fresh handoff.
        const me = sim.getPlayerEntity(join.playerId)!;
        me.hp = 0;
        let guard = 0;
        while (sim.getPlayerEntity(join.playerId)!.hp <= 0 && guard++ < 60) sim.step();
        expect(sim.getPlayerEntity(join.playerId)!.hp, `seed ${seed}: never respawned`).toBe(PLAYER_MAX_HP);
        expect(sim.getWeapon(join.playerId), `seed ${seed}: respawned unarmed`).toBe("sword");
        sampleGraceWindow(sim, join.playerId, sim.tick + SPAWN_GRACE_TICKS, `seed ${seed} respawn`);
      }
    },
    FUZZ_TIMEOUT_MS,
  );
});

/** Step the real tick loop to the end of the grace window, asserting the
 * replicated invariants at every graced tick: no hostile inside the
 * clearance radius, and full hp (zero damage before the first input —
 * none is ever sent). Reads the player's own snapshot, so it checks
 * exactly what the client would have rendered each frame. */
function sampleGraceWindow(sim: GameSim, playerId: string, graceUntil: number, label: string): void {
  while (sim.tick + 1 < graceUntil) {
    const snap = sim.step().get(playerId) as ServerSnapshot;
    let nearest = Infinity;
    for (const e of snap.entities) {
      if (e.kind !== "enemy") continue;
      nearest = Math.min(nearest, Math.hypot(e.x - snap.self.x, e.y - snap.self.y));
    }
    expect(nearest, `${label} tick ${sim.tick}: hostile inside graced clearance`).toBeGreaterThanOrEqual(
      SPAWN_CLEARANCE_RADIUS,
    );
    expect(snap.self.hp, `${label} tick ${sim.tick}: damage before first input`).toBe(PLAYER_MAX_HP);
  }
}
