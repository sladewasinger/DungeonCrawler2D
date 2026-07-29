import {
  areasData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import {
  LEVEL,
  World,
  buildContentRegistry,
  createBody,
  hashString,
  makeEntity,
  type Entity,
} from "@dc2d/engine";
import { PlayerStore } from "../../../store.js";
import { createSimState, type PlayerSlot, type SimState } from "../../state/state.js";

const content = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});

export function createEnemyTestSim(): SimState {
  return createSimState({
    world: new World(hashString("enemies-test-world"), 1, LEVEL.Dungeon),
    content,
    store: new PlayerStore(null),
    rngSeed: 42,
    opts: {},
  });
}

export function findEnemyTestFloor(sim: SimState): { x: number; y: number } {
  for (let radius = 0; radius < 64; radius++) {
    const floor = perimeterTiles(radius).find((tile) => isOpenFloor(sim, tile));
    if (floor) return { x: floor.x + 0.5, y: floor.y + 0.5 };
  }
  throw new Error("no open floor found near (200, 200)");
}

export function addEnemyTestPlayer(
  sim: SimState,
  spot: { x: number; y: number },
  id = "p1",
): PlayerSlot {
  const entity = makeEntity(
    "player",
    createBody(spot.x, spot.y, sim.world.groundAt(spot.x, spot.y)),
    { id, hp: 30, maxHp: 30, baseSpeed: 8 },
  );
  const slot = playerSlot(entity);
  sim.players.set(id, slot);
  return slot;
}

export function launchEnemyForPhysicsTest(enemy: Entity): void {
  enemy.body.z += 1;
  enemy.body.zVel = 0;
  enemy.body.grounded = false;
  enemy.body.fallStart = enemy.body.z;
}

function perimeterTiles(radius: number): Array<{ x: number; y: number }> {
  const tiles: Array<{ x: number; y: number }> = [];
  for (let offset = -radius; offset <= radius; offset++) {
    tiles.push(
      { x: 200 + offset, y: 200 - radius },
      { x: 200 + offset, y: 200 + radius },
    );
  }
  return tiles;
}

function isOpenFloor(sim: SimState, tile: { x: number; y: number }): boolean {
  return Array.from({ length: 5 }, (_, offset) => tile.x + offset).every((x) =>
    sim.world.isWalkable(x, tile.y) && !sim.world.isSanctuary(x, tile.y));
}

function playerSlot(entity: Entity): PlayerSlot {
  return {
    entity, clientId: `c-${entity.id}`, stored: { slot: 0, name: "tester", stash: [], contacts: [] },
    resumeToken: "tok", lastSeq: 0, pendingInputs: [], pendingActions: [], connected: true, reapAtTick: 0,
    known: new Set(), inventory: [], hotbar: [], weapon: null, outbox: [], returnStack: [], partyId: null,
    respawnAtTick: null, needsFullAreas: true, downedAtTick: null, attackReadyAtTick: 0, attackStartedAtTick: -1000,
    god: false, forceDeath: false, chatTimestamps: [], lastFistbumpOfferAtTick: -Infinity,
    spawnGraceUntilTick: 0, pendingTransfer: null,
  };
}
