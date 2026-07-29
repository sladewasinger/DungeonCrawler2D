import { areaReactionsData, areasData, enemiesData, itemsData, recipesData, rulesData, statusesData } from "@dc2d/content";
import { TILE, buildContentRegistry, createBody, makeEntity, newEntityId, type World } from "@dc2d/engine";
import { PlayerStore } from "../../store.js";
import { createSimState, type PlayerSlot, type SimState } from "../state/state.js";

const registry = buildContentRegistry({
  statuses: [...statusesData], rules: [...rulesData], areas: [...areasData], areaReactions: [...areaReactionsData],
  items: [...itemsData], enemies: [...enemiesData], recipes: [...recipesData],
});

export function fakeWorld(special: { x: number; y: number; tile: number } | null = null): World {
  const fake = {
    groundAt: () => 0,
    tileAt: (x: number, y: number) => special && x === special.x && y === special.y ? special.tile : TILE.Floor,
  };
  return fake as unknown as World;
}

export function buildSim(world: World): SimState {
  return createSimState({ world, content: registry, store: new PlayerStore(null), rngSeed: 1, opts: {} });
}

export function buildSlot(x: number, y: number, z = 0): PlayerSlot {
  const entity = makeEntity("player", createBody(x, y, z), { id: newEntityId("p"), hp: 100, maxHp: 100 });
  return {
    entity, clientId: "client-a", stored: { slot: 0, name: "A", stash: [], contacts: [] }, resumeToken: "t",
    lastSeq: 0, pendingInputs: [], pendingActions: [], connected: true, reapAtTick: 0,
    known: new Set<string>(), inventory: [], hotbar: Array(9).fill(null), weapon: null, outbox: [],
    returnStack: [], partyId: null, respawnAtTick: null, needsFullAreas: false,
    downedAtTick: null, attackReadyAtTick: 0, attackStartedAtTick: 0, god: false, forceDeath: false,
    chatTimestamps: [], lastFistbumpOfferAtTick: -Infinity, spawnGraceUntilTick: 0, pendingTransfer: null,
  };
}
