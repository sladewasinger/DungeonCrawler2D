import { areaReactionsData, areasData, enemiesData, itemsData, recipesData, rulesData, statusesData } from "@dc2d/content";
import { TILE, buildContentRegistry, createBody, makeEntity, type World } from "@dc2d/engine";
import { PlayerStore } from "../../store.js";
import { spawnPlayerLootChest } from "./lootChests.js";
import { createSimState, type PlayerSlot } from "../state/state.js";

const content = buildContentRegistry({
  statuses: [...statusesData], rules: [...rulesData], areas: [...areasData], areaReactions: [...areaReactionsData],
  items: [...itemsData], enemies: [...enemiesData], recipes: [...recipesData],
});

const world = { isWalkable: () => true, groundAt: () => 0, tileAt: () => TILE.Floor } as unknown as World;

function slot(request: { id: string; name: string; x?: number; y?: number }): PlayerSlot {
  const { id, name, x = 0, y = 0 } = request;
  return {
    entity: makeEntity("player", createBody(x, y, 0), { id, name, hp: 20, maxHp: 20 }),
    clientId: `client-${id}`, stored: { slot: 0, name, stash: [], contacts: [] }, resumeToken: `token-${id}`,
    lastSeq: 0, pendingInputs: [], pendingActions: [], connected: true, reapAtTick: Infinity,
    known: new Set<string>(), inventory: [{ item: "rag", qty: 3 }, { item: "torch", qty: 2 }], hotbar: [],
    weapon: null, outbox: [], returnStack: [], partyId: null, respawnAtTick: null, needsFullAreas: false,
    downedAtTick: null, attackReadyAtTick: 0, attackStartedAtTick: -Infinity, god: false, forceDeath: false,
    chatTimestamps: [], lastFistbumpOfferAtTick: -Infinity, spawnGraceUntilTick: 0, pendingTransfer: null,
  };
}

export function setup() {
  const sim = createSimState({ world, content, store: new PlayerStore(null), rngSeed: 1, opts: {} });
  const victim = slot({ id: "victim", name: "Crawler 123" });
  const killer = slot({ id: "killer", name: "Crawler 456" });
  const stranger = slot({ id: "stranger", name: "Crawler 789" });
  victim.lastDamagedByPlayerId = killer.entity.id;
  sim.players.set(victim.entity.id, victim);
  sim.players.set(killer.entity.id, killer);
  sim.players.set(stranger.entity.id, stranger);
  const chest = spawnPlayerLootChest(sim, victim);
  if (!chest) throw new Error("expected death loot chest");
  for (const player of [killer, stranger]) {
    player.entity.body.x = chest.entity.body.x;
    player.entity.body.y = chest.entity.body.y;
  }
  return { sim, victim, killer, stranger, chest };
}
