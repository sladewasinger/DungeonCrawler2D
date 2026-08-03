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
import { adminTestPlayerState } from "../../testing/adminTestPlayerState.js";

const content = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  areaReactions: [...areaReactionsData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});

const TEST_PATCH_RADIUS = 8;

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
  const baseHeight = sim.world.heightAt(tile.x, tile.y);
  for (let offsetY = -TEST_PATCH_RADIUS; offsetY <= TEST_PATCH_RADIUS; offsetY += 1) {
    for (let offsetX = -TEST_PATCH_RADIUS; offsetX <= TEST_PATCH_RADIUS; offsetX += 1) {
      if (!isOpenPatchCell({ sim, tile, offsetX, offsetY, baseHeight })) {
        return false;
      }
    }
  }
  return true;
}

function isOpenPatchCell(input: {
  sim: SimState;
  tile: { x: number; y: number };
  offsetX: number;
  offsetY: number;
  baseHeight: number;
}): boolean {
  const x = input.tile.x + input.offsetX;
  const y = input.tile.y + input.offsetY;
  return input.sim.world.isWalkable(x, y)
    && !input.sim.world.isSanctuary(x, y)
    && input.sim.world.heightAt(x, y) === input.baseHeight;
}

function playerSlot(entity: Entity): PlayerSlot {
  return {
    entity, clientId: `c-${entity.id}`, stored: { slot: 0, name: "tester", stash: [], contacts: [] },
    resumeToken: "tok", lastSeq: 0, pendingInputs: [], pendingActions: [], connected: true, reapAtTick: 0,
    known: new Set(), inventory: [], hotbar: [], weapon: null, outbox: [], returnStack: [], partyId: null,
    respawnAtTick: null, needsFullAreas: true, downedAtTick: null, attackReadyAtTick: 0, attackStartedAtTick: -1000,
    god: false, ...adminTestPlayerState(), forceDeath: false, chatTimestamps: [], lastFistbumpOfferAtTick: -Infinity,
    spawnGraceUntilTick: 0, pendingTransfer: null,
  };
}
