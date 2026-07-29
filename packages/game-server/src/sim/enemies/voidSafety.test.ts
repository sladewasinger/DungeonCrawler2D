import {
  areasData,
  areaReactionsData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import {
  buildContentRegistry,
  hashString,
  LEVEL,
  makeEntity,
  TILE,
  World,
  createBody,
  type ContentRegistry,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { resolveDeaths } from "../combat/deaths.js";
import { spawnEnemy } from "../core/helpers.js";
import { createSimState, type PlayerSlot, type SimState } from "../state/state.js";
import { PlayerStore } from "../../store.js";
import { findWorldPoint } from "../combat/chasmTestSupport.js";
import { stepEnemies } from "./index.js";

/**
 * Regression for the "enemies in the void" playtest defect (Epic 7.13): an
 * enemy that ends up in a chasm (chased or knocked in) must die by the same
 * ruling a player would, including while locked into its shoot decision.
 */

const content: ContentRegistry = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  areaReactions: [...areaReactionsData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});

function makeScoutSlot(x: number, y: number, sim: SimState): PlayerSlot {
  const entity = makeEntity("player", createBody(x, y, sim.world.groundAt(x, y)), {
    id: "scout",
    hp: 30,
    maxHp: 30,
    baseSpeed: 8,
  });
  return {
    entity,
    clientId: "scout-client",
    stored: { slot: 0, name: "scout", stash: [], contacts: [] },
    resumeToken: "scout-token",
    lastSeq: 0,
    pendingInputs: [],
    pendingActions: [],
    connected: true,
    reapAtTick: 0,
    known: new Set(),
    inventory: [],
    hotbar: [],
    weapon: null,
    outbox: [],
    returnStack: [],
    partyId: null,
    respawnAtTick: null,
    needsFullAreas: true,
    downedAtTick: null,
    attackReadyAtTick: 0,
    attackStartedAtTick: -1000,
    god: false,
    forceDeath: false,
    chatTimestamps: [],
    lastFistbumpOfferAtTick: -Infinity, spawnGraceUntilTick: 0, pendingTransfer: null,
  };
}

/** Any explicit void tile at or below chasm depth, scanning outward from the
 * origin (mirrors sim/chasmDeath.test.ts's findChasmFloor). */
function findChasmFloor(world: World): { x: number; y: number } | null {
  return findWorldPoint({ world, predicate: ({ tile }) => tile === TILE.Void });
}

describe("enemy void safety: a ranged enemy locked into shooting still dies in a chasm", () => {
  it("a spitter placed directly in a rift, in range of a stationary player, dies on its first active tick", () => {
    const world = new World(hashString("void-safety-spitter"), 1, LEVEL.Dungeon);
    const sim = createSimState({ world, content, store: new PlayerStore(null), rngSeed: 7, opts: {} });
    const rift = findChasmFloor(world);
    expect(rift, "no chasm floor found in scan range").not.toBeNull();
    if (!rift) return;

    // Player close enough to be within the spitter's aggroRadius (10)
    // and attack range (7), so enemyThink returns a `shoot` decision
    // every tick it's off cooldown — the exact branch that used to
    // `continue` past the chasm-death check entirely.
    const scout = makeScoutSlot(rift.x + 3.5, rift.y + 0.5, sim);
    sim.players.set(scout.entity.id, scout);

    const spitter = spawnEnemy(sim, { defId: "spitter", x: rift.x + 0.5, y: rift.y + 0.5 });
    spitter.body.z = sim.world.heightAt(rift.x, rift.y);
    spitter.body.grounded = true;
    const spitterSlot = sim.enemies.get(spitter.id);
    expect(spitterSlot).toBeDefined();
    if (!spitterSlot) return;
    spitterSlot.animation = {
      state: "windup",
      ticksRemaining: 5,
      target: { targetId: scout.entity.id, x: scout.entity.body.x, y: scout.entity.body.y, z: scout.entity.body.z },
    };

    stepEnemies(sim, []);
    resolveDeaths(sim);

    expect(sim.enemies.has(spitter.id)).toBe(false);
  });
});
