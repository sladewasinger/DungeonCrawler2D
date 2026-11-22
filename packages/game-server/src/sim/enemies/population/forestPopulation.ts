/** Spawns outdoor forest wildlife (wolf packs, solitary bears, spiders, boars), bandit camp POIs, and natural forage. */
import {
  CHUNK_SIZE,
  TILE,
  createBody,
  makeEntity,
  newEntityId,
  type InvStack,
} from "@dc2d/engine";
import { spawnEnemy, spawnItem } from "../../core/helpers.js";
import { spawnWildLootChest } from "../../lootChests/lootChests.js";
import type { SimState } from "../../state/state.js";
import {
  canAddNearSpawnEnemies,
  isInsideSpawnEnemyExclusion,
  isNearSpawnPopulationPosition,
} from "./nearSpawn.js";
import { randomChunkSpot, randomNearbySpot } from "../populationPlacement.js";

const ENEMY_CAP = 150;
const ROAMING_SOLO_MOBS = ["forest-spider", "wild-boar", "slime", "wolf"] as const;

export function populateForestChunkFeatures(
  sim: SimState,
  cx: number,
  cy: number,
): void {
  spawnNaturalForage(sim, cx, cy);
  if (sim.enemies.size >= ENEMY_CAP) return;
  spawnWolfPackOrRoamingMobs(sim, cx, cy);
  spawnSolitaryGrizzlyOrBanditCamp(sim, cx, cy);
}

function spawnNaturalForage(sim: SimState, cx: number, cy: number): void {
  const baseX = cx * CHUNK_SIZE;
  const baseY = cy * CHUNK_SIZE;
  for (let i = 0; i < 3; i++) {
    const tx = baseX + 3 + Math.floor(sim.rng.next() * (CHUNK_SIZE - 6));
    const ty = baseY + 3 + Math.floor(sim.rng.next() * (CHUNK_SIZE - 6));
    if (!sim.world.isWalkable(tx, ty)) continue;
    const defId = forageDefForTile(sim.world.tileAt(tx, ty), sim.rng.next());
    spawnItem(sim, { defId, x: tx + 0.5, y: ty + 0.5, qty: 1 });
  }
}

function forageDefForTile(tile: number, roll: number): string {
  if (tile === TILE.Bush) return "herb";
  if (roll < 0.4) return "herb";
  return roll < 0.75 ? "stick" : "flint";
}

function spawnWolfPackOrRoamingMobs(sim: SimState, cx: number, cy: number): void {
  const anchor = randomChunkSpot(sim, cx, cy);
  if (!anchor) return;
  const center = { x: anchor.x + 0.5, y: anchor.y + 0.5 };
  if (isInsideSpawnEnemyExclusion(sim, center)) return;
  if (sim.rng.next() < 0.45) {
    trySpawnWolfPack(sim, anchor);
    return;
  }
  const defId = ROAMING_SOLO_MOBS[Math.floor(sim.rng.next() * ROAMING_SOLO_MOBS.length)]!;
  trySpawnCheckedEnemy(sim, defId, anchor);
}

function trySpawnWolfPack(sim: SimState, anchor: { x: number; y: number }): void {
  const spots = collectWolfPackSpots(sim, anchor);
  const nearDefs = spots
    .filter((s) => isNearSpawnPopulationPosition(sim, { x: s.x + 0.5, y: s.y + 0.5 }))
    .map(() => "wolf");
  if (!canAddNearSpawnEnemies(sim, nearDefs)) return;
  for (const spot of spots) {
    trySpawnCheckedEnemy(sim, "wolf", spot);
  }
}

function collectWolfPackSpots(sim: SimState, anchor: { x: number; y: number }) {
  const packSize = 2 + Math.floor(sim.rng.next() * 2);
  const spots = [anchor];
  for (let i = 1; i < packSize; i++) {
    const next = randomNearbySpot(sim, anchor, 4);
    if (next) spots.push(next);
  }
  return spots;
}

function spawnSolitaryGrizzlyOrBanditCamp(sim: SimState, cx: number, cy: number): void {
  const spot = randomChunkSpot(sim, cx, cy);
  if (!spot) return;
  const center = { x: spot.x + 0.5, y: spot.y + 0.5 };
  if (isNearSpawnPopulationPosition(sim, center) || isInsideSpawnEnemyExclusion(sim, center)) {
    return;
  }
  const roll = sim.rng.next();
  if (roll < 0.25 && sim.enemies.size < ENEMY_CAP) {
    spawnEnemy(sim, { defId: "grizzly-bear", x: center.x, y: center.y });
  } else if (roll < 0.52) {
    spawnBanditCamp(sim, spot);
  }
}

function spawnBanditCamp(sim: SimState, spot: { x: number; y: number }): void {
  const z = sim.world.groundAt(spot.x + 0.5, spot.y + 0.5);
  const campfire = makeEntity("torch", createBody(spot.x + 0.5, spot.y + 0.5, z), {
    id: newEntityId("t"),
    defId: "torch",
    torchState: "placed",
    expiresAtTick: Number.MAX_SAFE_INTEGER,
  });
  sim.torches.set(campfire.id, campfire);

  const chestSpot = randomNearbySpot(sim, spot, 2) ?? spot;
  const chestZ = sim.world.groundAt(chestSpot.x + 0.5, chestSpot.y + 0.5);
  spawnWildLootChest(sim, {
    x: chestSpot.x + 0.5,
    y: chestSpot.y + 0.5,
    z: chestZ,
    label: "Bandit Camp Chest",
    slots: banditChestLoot(sim),
  });

  const guardDef = sim.rng.next() < 0.55 ? "goblin" : "skeleton";
  for (let i = 0; i < 2 && sim.enemies.size < ENEMY_CAP; i++) {
    const guardSpot = randomNearbySpot(sim, spot, 3) ?? spot;
    trySpawnCheckedEnemy(sim, guardDef, guardSpot);
  }
}

function banditChestLoot(sim: SimState): InvStack[] {
  const loot: InvStack[] = [
    { item: "arrow", qty: 6 },
    { item: "cooked-meat", qty: 2 },
    { item: "bandage", qty: 2 },
    { item: "flint", qty: 2 },
  ];
  const bonusRoll = sim.rng.next();
  if (bonusRoll < 0.35) loot.push({ item: "bow", qty: 1 });
  else if (bonusRoll < 0.65) loot.push({ item: "wolf-pelt", qty: 2 });
  else loot.push({ item: "spider-silk", qty: 2 });
  return loot;
}

function trySpawnCheckedEnemy(sim: SimState, defId: string, spot: { x: number; y: number }): void {
  if (sim.enemies.size >= ENEMY_CAP) return;
  const center = { x: spot.x + 0.5, y: spot.y + 0.5 };
  if (isInsideSpawnEnemyExclusion(sim, center)) return;
  if (isNearSpawnPopulationPosition(sim, center) && !canAddNearSpawnEnemies(sim, [defId])) return;
  spawnEnemy(sim, { defId, x: center.x, y: center.y });
}
