import { TICK_DT, type EffectEvent } from "@dc2d/engine";
import { processActions } from "./actions/index.js";
import { applyHealthRegeneration } from "./combatResources.js";
import { expireFistbumpOffers } from "./contacts.js";
import { resolveDeaths } from "./deaths.js";
import {
  activateChunksNearPlayers,
  REPOPULATE_INTERVAL_TICKS,
  repopulateNearSpawn,
  stepEnemies,
} from "./enemies/index.js";
import { drainReadyTransfers, stepBoss } from "./floors/index.js";
import { expireLootChests } from "./lootChests.js";
import { stepFoodAttendantDialogs } from "./npcs/foodAttendant/index.js";
import { stepPets } from "./pets/index.js";
import { applyGodMode, reapAndRespawn, stepPlayers } from "./players.js";
import { stepProjectiles } from "./projectiles.js";
import { syncSafeRoomDoors } from "./safeRoomDoors.js";
import { expireInvites } from "./social.js";
import { maintainSpawnClearance } from "./spawnSafety.js";
import { applyAreaContact, realizeEffectEvents, tickStatuses } from "./statuses.js";
import { TEST_ZONE_RESEED_TICKS, seedTestZoneHazards, seedTestZoneItems } from "./testzone.js";
import { stepTorches } from "./torches.js";
import type { SimState } from "./state.js";

export function advanceSimTick(sim: SimState): void {
  sim.tickCount++;
  const effectEvents: EffectEvent[] = [];
  prepareSimTick(sim, effectEvents);
  stepSimActors(sim, effectEvents);
  resolveSimTick(sim, effectEvents);
}

function prepareSimTick(sim: SimState, effectEvents: EffectEvent[]): void {
  reapAndRespawn(sim);
  syncSafeRoomDoors(sim);
  stepPlayers(sim, effectEvents);
  processActions(sim, effectEvents);
  stepFoodAttendantDialogs(sim);
  stepPets(sim);
  activateChunksNearPlayers(sim);
  repopulateEnemies(sim);
}

function repopulateEnemies(sim: SimState): void {
  if (sim.tickCount % REPOPULATE_INTERVAL_TICKS === 0) repopulateNearSpawn(sim);
  if (!sim.hazardsActive || sim.tickCount % TEST_ZONE_RESEED_TICKS !== 0) return;
  const claimed = new Set<string>();
  seedTestZoneHazards(sim, claimed);
  seedTestZoneItems(sim, claimed);
}

function stepSimActors(sim: SimState, effectEvents: EffectEvent[]): void {
  maintainSpawnClearance(sim);
  if (!sim.opts.freezeEnemies) {
    stepEnemies(sim, effectEvents);
    stepProjectiles(sim, effectEvents);
  }
  stepTorches(sim);
  sim.areas.tick(TICK_DT, () => sim.rng.next());
}

function resolveSimTick(sim: SimState, effectEvents: EffectEvent[]): void {
  applyAreaContact(sim, effectEvents);
  tickStatuses(sim, effectEvents);
  applyHealthRegeneration(sim, effectEvents);
  realizeEffectEvents(sim, effectEvents);
  applyGodMode(sim);
  resolveDeaths(sim);
  expireLootChests(sim);
  stepBoss(sim);
  expireInvites(sim);
  expireFistbumpOffers(sim);
  drainReadyTransfers(sim);
}
