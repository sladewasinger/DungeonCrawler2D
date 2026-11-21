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
  COMBAT_SANDBOX_LAYOUT,
  LEVEL,
  TILE,
  buildContentRegistry,
  createBody,
  makeEntity,
  type Entity,
} from "@dc2d/engine";
import { PlayerStore } from "../../../store.js";
import { createSimState, type PlayerSlot, type SimState } from "../../state/state.js";
import { adminTestPlayerState } from "../../testing/adminTestPlayerState.js";
import {
  authoredServerWorldFixture,
  finiteServerWorldFixture,
} from "../../testing/finiteWorldTestSupport.js";

const content = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  areaReactions: [...areaReactionsData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});

export function createEnemyTestSim(): SimState {
  return createSimState({
    world: authoredServerWorldFixture(LEVEL.CombatSandbox, 1),
    content,
    store: new PlayerStore(null),
    rngSeed: 42,
    opts: {},
  });
}

export function createFiniteEnemyTestSim(): SimState {
  return createSimState({
    world: finiteServerWorldFixture(),
    content,
    store: new PlayerStore(null),
    rngSeed: 42,
    opts: {},
  });
}

export function findEnemyTestFloor(sim: SimState): { x: number; y: number } {
  const center = largestFixtureRoomCenter(sim) ?? authoredArenaCenter();
  sim.world.replaceTileOverrides(flatTestPatch(center));
  return { x: center.x + 0.5, y: center.y + 0.5 };
}

function authoredArenaCenter(): { x: number; y: number } {
  return {
    x: Math.floor(COMBAT_SANDBOX_LAYOUT.playerSpawn.x),
    y: Math.floor(COMBAT_SANDBOX_LAYOUT.playerSpawn.y),
  };
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

function largestFixtureRoomCenter(sim: SimState): { x: number; y: number } | undefined {
  return [...(sim.world.generatedFloor?.rooms ?? [])]
    .sort((left, right) => roomArea(right) - roomArea(left))[0]?.center;
}

function roomArea(room: { x0: number; y0: number; x1: number; y1: number }): number {
  return (room.x1 - room.x0 + 1) * (room.y1 - room.y0 + 1);
}

function flatTestPatch(center: { readonly x: number; readonly y: number }) {
  const tiles: Array<{ x: number; y: number; tile: typeof TILE.Floor }> = [];
  for (let offsetY = -10; offsetY <= 10; offsetY += 1) {
    for (let offsetX = -10; offsetX <= 10; offsetX += 1) {
      tiles.push({
        x: center.x + offsetX,
        y: center.y + offsetY,
        tile: TILE.Floor,
      });
    }
  }
  return tiles;
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
